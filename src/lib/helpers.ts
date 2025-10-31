import type { OpenAPIV3_1 } from "openapi-types";
import { z } from "zod";

export type SpecItem = {
	format: "json" | "text";
	parameters?: {
		path?: z.ZodType;
		query?: z.ZodType;
		headers?: z.ZodType;
	};
	responses: {
		[key: number]: {
			summary: string;
			description: string;
			schema: z.ZodType;
		};
	};
};
export type CustomSpec = {
	[key: string]: SpecItem;
};

export function defineSpec(spec: CustomSpec): CustomSpec {
	if (!spec || Object.keys(spec).length === 0) {
		throw new Error("Spec object cannot be empty");
	}

	return spec;
}

/**
 * Converts a Zod schema to OpenAPI 3.1 JSON Schema
 * Based on the actual Zod runtime structure inspection
 */
export function zodToOpenAPISchema(
	zodSchema: z.ZodType,
): OpenAPIV3_1.SchemaObject {
	try {
		const def = zodSchema._def as unknown as Record<string, unknown>;
		const type = def.type as string;
		const description = (zodSchema as z.ZodType & { description?: string })
			.description;

		let baseSchema: OpenAPIV3_1.SchemaObject;

		switch (type) {
			case "string":
				baseSchema = { type: "string" };
				break;

			case "number":
				baseSchema = { type: "number" };
				break;

			case "boolean":
				baseSchema = { type: "boolean" };
				break;

			case "date":
				baseSchema = {
					type: "string",
					format: "date-time",
				};
				break;

			case "enum": {
				// For enums, get the possible values from entries
				const entries = def.entries as Record<string, string | number>;
				const values = Object.values(entries);
				baseSchema = {
					type: typeof values[0] === "string" ? "string" : "number",
					enum: values,
				};
				break;
			}

			case "array": {
				// For arrays, get the element type
				const element = def.element as z.ZodType;
				baseSchema = {
					type: "array",
					items: zodToOpenAPISchema(element),
				};
				break;
			}

			case "object": {
				// For objects, process the shape
				const shape = def.shape as Record<string, z.ZodType>;
				const properties: Record<string, OpenAPIV3_1.SchemaObject> = {};
				const required: string[] = [];

				for (const [key, value] of Object.entries(shape)) {
					properties[key] = zodToOpenAPISchema(value);

					// Check if field is required (not wrapped in default or optional)
					const fieldDef = value._def as unknown as Record<string, unknown>;
					const fieldType = fieldDef.type as string;
					if (fieldType !== "optional" && fieldType !== "default") {
						required.push(key);
					}
				}

				baseSchema = {
					type: "object",
					properties,
				};

				if (required.length > 0) {
					baseSchema.required = required;
				}
				break;
			}

			case "default": {
				// Handle default values - extract the inner type and default value
				const innerType = def.innerType as z.ZodType;
				const defaultValue = def.defaultValue;

				const innerSchema = zodToOpenAPISchema(innerType);
				baseSchema = {
					...innerSchema,
					default: defaultValue,
				};
				break;
			}

			case "optional": {
				// Handle optional values - get the inner type and preserve description
				const innerType = def.innerType as z.ZodType;
				const innerSchema = zodToOpenAPISchema(innerType);
				baseSchema = innerSchema;
				break;
			}

			default:
				// Fallback for unsupported types
				console.warn(`Unsupported Zod type: ${type}`);
				baseSchema = { type: "object" };
		}

		// Add description if it exists
		if (description) {
			baseSchema.description = description;
		}

		return baseSchema;
	} catch (error) {
		console.warn("Error parsing Zod schema:", error);
		// Fallback for any errors
		return { type: "object" };
	}
}

/**
 * Converts a CustomSpec to OpenAPI 3.1 PathItemObject format
 */
export function customSpecToOpenAPI(
	spec: CustomSpec,
): Record<string, OpenAPIV3_1.PathItemObject> {
	const paths: Record<string, OpenAPIV3_1.PathItemObject> = {};

	for (const [method, specItem] of Object.entries(spec)) {
		const httpMethod = method.toLowerCase() as keyof OpenAPIV3_1.PathItemObject;

		// Convert responses
		const responses: OpenAPIV3_1.ResponsesObject = {};

		for (const [statusCode, responseSpec] of Object.entries(
			specItem.responses,
		)) {
			const status = statusCode.toString();

			responses[status] = {
				description: responseSpec.description,
				content: {
					[specItem.format === "json" ? "application/json" : "text/plain"]: {
						schema: zodToOpenAPISchema(responseSpec.schema),
					},
				},
			};
		}

		const operationObject: OpenAPIV3_1.OperationObject = {
			responses,
		};

		// Add parameters if they exist
		if (specItem.parameters) {
			const parameters: OpenAPIV3_1.ParameterObject[] = [];

			// Handle path parameters
			if (specItem.parameters.path) {
				const pathSchema = specItem.parameters.path;
				if (pathSchema instanceof z.ZodObject) {
					const shape = pathSchema.shape;
					for (const [name, fieldSchema] of Object.entries(shape)) {
						parameters.push({
							name,
							in: "path",
							required: true, // Path parameters are always required
							schema: zodToOpenAPISchema(fieldSchema as z.ZodType),
						} as OpenAPIV3_1.ParameterObject);
					}
				}
			}

			// Handle query parameters
			if (specItem.parameters.query) {
				const querySchema = specItem.parameters.query;
				if (querySchema instanceof z.ZodObject) {
					const shape = querySchema.shape;
					for (const [name, fieldSchema] of Object.entries(shape)) {
						const isOptional =
							fieldSchema instanceof z.ZodOptional ||
							fieldSchema instanceof z.ZodDefault;
						parameters.push({
							name,
							in: "query",
							required: !isOptional,
							schema: zodToOpenAPISchema(fieldSchema as z.ZodType),
						} as OpenAPIV3_1.ParameterObject);
					}
				}
			}

			// Handle header parameters
			if (specItem.parameters.headers) {
				const headerSchema = specItem.parameters.headers;
				if (headerSchema instanceof z.ZodObject) {
					const shape = headerSchema.shape;
					for (const [name, fieldSchema] of Object.entries(shape)) {
						const isOptional =
							fieldSchema instanceof z.ZodOptional ||
							fieldSchema instanceof z.ZodDefault;
						parameters.push({
							name,
							in: "header",
							required: !isOptional,
							schema: zodToOpenAPISchema(fieldSchema as z.ZodType),
						} as OpenAPIV3_1.ParameterObject);
					}
				}
			}

			if (parameters.length > 0) {
				operationObject.parameters = parameters;
			}
		}

		// Initialize the path object if it doesn't exist
		if (!paths["/"]) {
			paths["/"] = {};
		}

		// Add the operation to the path using proper typing
		const pathItem = paths["/"] as Record<string, OpenAPIV3_1.OperationObject>;
		pathItem[httpMethod] = operationObject;
	}

	return paths;
}

/**
 * Generates a complete OpenAPI 3.1 document from a CustomSpec
 */
export function generateOpenAPIFromCustomSpec(
	spec: CustomSpec,
	info: {
		title: string;
		version: string;
		description?: string;
	} = {
		title: "API Documentation",
		version: "1.0.0",
		description: "Generated from CustomSpec",
	},
): OpenAPIV3_1.Document {
	const paths = customSpecToOpenAPI(spec);

	return {
		openapi: "3.1.0",
		info,
		paths,
	};
}

// Type helper to extract valid status codes from OpenAPI spec
type ExtractStatusCodes<T extends OpenAPIV3_1.OperationObject> = T extends {
	responses: infer R;
}
	? keyof R extends string
		? keyof R
		: never
	: never;

// Type helper to convert string status codes to numbers
type StatusCodeToNumber<T extends string> =
	T extends `${infer N extends number}`
		? N
		: T extends "default"
			? number
			: never;

// Enhanced RouteProps with request parameters and body
export type RouteProps = {
	request: Request;
	params?: Record<string, string>;
	body?: unknown;
	query?: Record<string, string>;
	validator?: unknown;
};

// Type-safe Response creator with compile-time validation
export function createTypedResponse<T extends OpenAPIV3_1.OperationObject>(
	_spec: T,
): {
	json: (
		data: unknown,
		init?: ResponseInit & {
			status?: StatusCodeToNumber<ExtractStatusCodes<T>>;
		},
	) => Response;
} {
	return {
		json: (
			data: unknown,
			init?: ResponseInit & {
				status?: StatusCodeToNumber<ExtractStatusCodes<T>>;
			},
		) => {
			return Response.json(data, init);
		},
	};
}

export type CreateRouteProps = {
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	callback?: (props: RouteProps) => Promise<Response>;
	spec?: SpecItem;
};

export function createRoute({ method, callback, spec }: CreateRouteProps) {
	if (!callback) {
		return { method, callback };
	}

	// If spec is provided, wrap the callback with validation
	const wrappedCallback = spec
		? async (props: RouteProps): Promise<Response> => {
				const response = await callback(props);

				try {
					validateResponseAgainstSpec(response, spec, method);
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					console.error(
						`OpenAPI spec validation failed for ${method.toUpperCase()}:`,
						errorMessage,
					);

					// In development, throw the error to help with debugging
					if (
						process.env.NODE_ENV === "development" ||
						process.env.ENVIRONMENT === "development"
					) {
						throw error;
					}

					// In production, log but don't break the response
					// You might want to change this behavior based on your needs
				}

				return response;
			}
		: callback;

	return { method, callback: wrappedCallback };
}
function validateResponseAgainstSpec(
	response: Response,
	spec: SpecItem,
	method: string,
): void {
	if (!spec.responses) {
		return; // No spec to validate against
	}

	const statusCode = response.status;
	const specResponse = spec.responses[statusCode];

	if (!specResponse) {
		return;
	}

	// Validate Content-Type if specified in the spec;
	if (
		specResponse &&
		typeof specResponse === "object" &&
		"content" in specResponse &&
		specResponse.content
	) {
		const contentType = response.headers.get("Content-Type");
		const expectedContentTypes = Object.keys(specResponse.content);

		if (expectedContentTypes.length > 0 && contentType) {
			const normalizedContentType = contentType.split(";")[0]; // Remove charset info
			const isValidContentType = expectedContentTypes.some(
				(expected) =>
					normalizedContentType === expected ||
					normalizedContentType?.startsWith(expected),
			);

			if (!isValidContentType) {
				console.warn(
					`Response Content-Type "${contentType}" does not match expected types in spec: ${expectedContentTypes.join(", ")} for ${method.toUpperCase()} ${statusCode} response`,
				);
			}
		}
	}

	// Additional validation could be added here for:
	// - Response body schema validation using a JSON schema validator
	// - Header validation
	// - Response size validation
}
