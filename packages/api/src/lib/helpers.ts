import type { OpenAPIV3_1 } from "openapi-types";
import { z } from "zod";
import type { ProxyConfig } from "./config";
import { getConfig } from "./config";
import { getLogger } from "./logger";

// Proxy-related types and interfaces
export interface ProxyMatchResult {
	matched: boolean;
	params: Record<string, string>;
	config: ProxyConfig;
}

export interface ProxyExecutionContext {
	request: Request;
	params: Record<string, string>;
	config: ProxyConfig;
	startTime: number;
}

/**
 * Matches a request path against a wildcard pattern and extracts parameters
 * Supports patterns like:
 * - "/api/star" (matches /api/users, /api/posts, etc.)
 * - "/api/doublestar" (matches /api/users, /api/users/123, /api/users/123/posts, etc.)
 * - "/auth/star/protected" (matches /auth/user123/protected, /auth/admin/protected, etc.)
 * - "/users/star/posts/star" (matches /users/123/posts/456, etc.)
 * Note: star=single asterisk matches single path segment, doublestar=double asterisk matches any number of path segments
 */
export function matchProxyPattern(
	requestPath: string,
	pattern: string,
): { matched: boolean; params: Record<string, string> } {
	// Convert wildcard pattern to regex
	// Replace * and ** with named capture groups and escape special regex characters
	const paramNames: string[] = [];
	let paramIndex = 0;

	// Process ** first to avoid interference with single *
	let processedPattern = pattern;

	// Handle ** (double asterisk) for recursive matching first
	processedPattern = processedPattern.replace(/\*\*/g, () => {
		const paramName = `param${paramIndex++}`;
		paramNames.push(paramName);
		return "___RECURSIVE_WILDCARD___"; // Temporary placeholder
	});

	// Then handle * (single asterisk) for single segment matching
	processedPattern = processedPattern.replace(/\*/g, () => {
		const paramName = `param${paramIndex++}`;
		paramNames.push(paramName);
		return "___SINGLE_WILDCARD___"; // Temporary placeholder
	});

	// Escape special regex characters
	processedPattern = processedPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

	// Replace placeholders with actual regex patterns
	processedPattern = processedPattern.replace(
		/___RECURSIVE_WILDCARD___/g,
		"(.*?)",
	);
	processedPattern = processedPattern.replace(
		/___SINGLE_WILDCARD___/g,
		"([^/]+)",
	);

	// Create regex for exact match
	const regex = new RegExp(`^${processedPattern}$`);
	const match = requestPath.match(regex);

	if (!match) {
		return { matched: false, params: {} };
	}

	// Extract parameters
	const params: Record<string, string> = {};
	paramNames.forEach((name, index) => {
		params[name] = match[index + 1] || "";
	});

	return { matched: true, params };
}

/**
 * Finds the best matching proxy configuration for a request path
 */
export function findMatchingProxyConfig(
	requestPath: string,
	proxyConfigs: ProxyConfig[],
): ProxyMatchResult | null {
	// Filter enabled configs and sort by pattern specificity (more specific patterns first)
	const enabledConfigs = proxyConfigs
		.filter((config) => config.enabled)
		.sort((a, b) => {
			// Patterns with fewer wildcards are more specific
			const aWildcards = (a.pattern.match(/\*/g) || []).length;
			const bWildcards = (b.pattern.match(/\*/g) || []).length;
			if (aWildcards !== bWildcards) {
				return aWildcards - bWildcards;
			}
			// If same wildcard count, longer patterns are more specific
			return b.pattern.length - a.pattern.length;
		});

	for (const config of enabledConfigs) {
		// Apply basePath if configured
		let targetPath = requestPath;
		const basePath = config.basePath || "/";

		if (basePath !== "/" && requestPath.startsWith(basePath)) {
			// Strip basePath prefix for pattern matching
			targetPath = requestPath.slice(basePath.length) || "/";
		} else if (basePath !== "/" && !requestPath.startsWith(basePath)) {
			// Request doesn't match this proxy's basePath
			continue;
		}

		const matchResult = matchProxyPattern(targetPath, config.pattern);
		if (matchResult.matched) {
			return {
				matched: true,
				params: matchResult.params,
				config,
			};
		}
	}

	return null;
}

/**
 * Executes a proxy request with optional handler for authentication/authorization
 */
export async function executeProxyRequest(
	context: ProxyExecutionContext,
): Promise<Response> {
	const { request, params, config } = context;
	const logger = getLogger();

	try {
		// Execute handler if provided (for auth, logging, etc.)
		if (config.handler) {
			const handlerResult = await config.handler({
				request,
				params,
				target: config.target,
			});

			// If handler says not to proceed, return the handler response
			if (!handlerResult.proceed) {
				return (
					handlerResult.response ||
					new Response("Proxy request blocked", { status: 403 })
				);
			}

			// Update target and headers if handler provided them
			if (handlerResult.target) {
				config.target = handlerResult.target;
			}
			if (handlerResult.headers) {
				config.headers = { ...config.headers, ...handlerResult.headers };
			}
		}

		// If no target is defined after handler execution, we can't proxy
		if (!config.target) {
			logger.warn(
				"No target defined for proxy request - request handled by handler",
			);
			// This means the handler should have returned a response in the handler
			// If we reach here without a response, it's likely a configuration error
			return new Response("No proxy target configured", { status: 500 });
		}

		// Build target URL
		const url = new URL(request.url);
		const targetUrl = new URL(config.target);

		// Preserve the original path and query parameters
		targetUrl.pathname = url.pathname;
		targetUrl.search = url.search;

		// Prepare headers
		const headers = new Headers();

		// Copy original request headers (excluding host)
		request.headers.forEach((value, key) => {
			if (key.toLowerCase() !== "host") {
				headers.set(key, value);
			}
		});

		// Add configured headers
		if (config.headers) {
			Object.entries(config.headers).forEach(([key, value]) => {
				headers.set(key, value);
			});
		}

		// Set appropriate host header for target
		headers.set("Host", targetUrl.host);

		// Prepare request options
		const requestOptions: RequestInit = {
			method: request.method,
			headers,
			signal: AbortSignal.timeout(config.timeout || 10000),
		};

		// Include body for methods that support it
		if (["POST", "PUT", "PATCH"].includes(request.method.toUpperCase())) {
			requestOptions.body = request.body;
		}

		// Execute proxy request with retries
		const maxRetries = config.retries || 0;
		let lastError: Error | null = null;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await fetch(targetUrl.toString(), requestOptions);

				// Log successful proxy if logging is enabled
				if (config.logging !== false) {
					logger.info(
						`Proxied ${request.method} ${url.pathname} -> ${targetUrl} (${response.status}) [attempt ${attempt + 1}]`,
					);
				}

				return response;
			} catch (error) {
				lastError = error as Error;

				if (attempt < maxRetries) {
					// Log retry attempt if logging is enabled
					if (config.logging !== false) {
						logger.warn(
							`Proxy attempt ${attempt + 1} failed, retrying: ${lastError.message}`,
						);
					}
					// Simple exponential backoff
					await new Promise((resolve) =>
						setTimeout(resolve, 2 ** attempt * 1000),
					);
				}
			}
		}

		// Log final failure if logging is enabled
		if (config.logging !== false) {
			logger.error(
				`Proxy failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
			);
		}

		return new Response("Proxy request failed", {
			status: 502,
			statusText: "Bad Gateway",
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		// Log execution error if logging is enabled
		if (config.logging !== false) {
			logger.error(`Proxy execution error: ${errorMessage}`);
		}

		return new Response("Proxy error", {
			status: 500,
			statusText: "Internal Server Error",
		});
	}
}

// Type helpers for extracting types from Zod schemas
type InferZodType<T> = T extends z.ZodType<infer U> ? U : never;

// Helper type to extract parameter types from spec
type ExtractParamTypes<TSpec extends SpecItem> = {
	path: TSpec["parameters"] extends { path: infer P }
		? P extends z.ZodType
			? InferZodType<P>
			: Record<string, string>
		: Record<string, string>;
	query: TSpec["parameters"] extends { query: infer Q }
		? Q extends z.ZodType
			? InferZodType<Q>
			: Record<string, string>
		: Record<string, string>;
	headers: TSpec["parameters"] extends { headers: infer H }
		? H extends z.ZodType
			? InferZodType<H>
			: Record<string, string>
		: Record<string, string>;
};

// Helper type to extract body type from spec (for POST/PUT/PATCH requests)
type ExtractBodyType<TSpec extends SpecItem> = TSpec["parameters"] extends {
	body: infer B;
}
	? B extends z.ZodType
		? InferZodType<B>
		: unknown
	: unknown;

export type SpecItem = {
	format: "json" | "text";
	tags?: string[];
	summary?: string;
	description?: string;
	parameters?: {
		path?: z.ZodType;
		query?: z.ZodType;
		headers?: z.ZodType;
		body?: z.ZodType;
	};
	responses: {
		[key: number]: {
			schema: z.ZodType;
		};
	};
};
export type CustomSpec = {
	[key: string]: SpecItem;
};

/**
 * Converts a Zod schema to OpenAPI 3.1 JSON Schema
 * Based on the actual Zod runtime structure inspection
 */
export function zodToOpenAPISchema(
	zodSchema: z.ZodType,
): OpenAPIV3_1.SchemaObject {
	const logger = getLogger();
	try {
		// Check if zodSchema is valid
		if (!zodSchema || typeof zodSchema !== "object" || !zodSchema._def) {
			logger.warn(zodSchema, "Invalid Zod schema provided:");
			return { type: "object" };
		}

		const def = zodSchema._def as unknown as Record<string, unknown>;
		const type = def.type as string;

		// Check if type is defined
		if (!type) {
			logger.warn(def, "Zod schema missing type:");
			return { type: "object" };
		}

		const description = (zodSchema as z.ZodType & { description?: string })
			.description;

		const config = getConfig();

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
				if (config.server.logLevel === "debug") {
					logger.debug(`Unsupported Zod type: ${type}`);
				}
				baseSchema = { type: "object" };
		}

		// Add description if it exists
		if (description) {
			baseSchema.description = description;
		}

		return baseSchema;
	} catch (error) {
		logger.warn(error, "Error parsing Zod schema:");
		// Fallback for any errors
		return { type: "object" };
	}
}

/**
 * Generates a default description for HTTP status codes
 */
function generateResponseDescription(statusCode: number): string {
	const descriptions: Record<number, string> = {
		200: "Successful response",
		201: "Created successfully",
		202: "Accepted for processing",
		204: "No content",
		400: "Bad request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Not found",
		405: "Method not allowed",
		409: "Conflict",
		422: "Unprocessable entity",
		500: "Internal server error",
		502: "Bad gateway",
		503: "Service unavailable",
	};

	return descriptions[statusCode] || `HTTP ${statusCode} response`;
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
				description: generateResponseDescription(Number(status)),
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

		// Add summary and description if they exist at the operation level
		if (specItem.summary) {
			operationObject.summary = specItem.summary;
		}
		if (specItem.description) {
			operationObject.description = specItem.description;
		}

		// If no operation-level summary/description, provide defaults
		if (!operationObject.summary) {
			operationObject.summary = "API Operation";
		}
		if (!operationObject.description) {
			// Use operation-level description or fall back to a default based on the first successful response
			const successStatusCodes = [200, 201, 202, 204];
			let defaultDescription = "Performs an API operation";

			for (const statusCode of successStatusCodes) {
				if (specItem.responses[statusCode]) {
					defaultDescription = generateResponseDescription(statusCode);
					break;
				}
			}

			// If no successful response found, use the first response
			if (defaultDescription === "Performs an API operation") {
				const firstResponseKey = Object.keys(specItem.responses)[0];
				if (firstResponseKey) {
					defaultDescription = generateResponseDescription(
						Number(firstResponseKey),
					);
				}
			}

			operationObject.description = defaultDescription;
		}

		// Add tags if they exist
		if (specItem.tags && specItem.tags.length > 0) {
			operationObject.tags = specItem.tags;
		}

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

			// Handle body parameters (convert to requestBody)
			if (specItem.parameters.body) {
				const bodySchema = specItem.parameters.body;
				operationObject.requestBody = {
					required: true,
					content: {
						[specItem.format === "json" ? "application/json" : "text/plain"]: {
							schema: zodToOpenAPISchema(bodySchema),
						},
					},
				};
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

// Enhanced RouteProps with typed parameters based on spec
export type RouteProps<TSpec extends SpecItem | undefined = undefined> = {
	request: Request;
} & (TSpec extends SpecItem
	? {
			params: ExtractParamTypes<TSpec>["path"];
			query: ExtractParamTypes<TSpec>["query"];
			headers: ExtractParamTypes<TSpec>["headers"];
			body: ExtractBodyType<TSpec>;
		}
	: {
			params?: Record<string, string>;
			query?: Record<string, string>;
			headers?: Record<string, string>;
			body?: unknown;
		});

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

export type CreateRouteProps<TSpec extends SpecItem | undefined = undefined> = {
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	handler?: (props: RouteProps<TSpec>) => Promise<Response>;
	spec?: TSpec;
};

export type RouteDefinition<TSpec extends SpecItem | undefined = undefined> = {
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	handler?: (props: RouteProps<TSpec>) => Promise<Response>;
	spec?: TSpec;
};

// Enhanced createRoute function with parameter validation and type inference
export function createRoute<TSpec extends SpecItem | undefined = undefined>({
	method,
	handler,
	spec,
}: CreateRouteProps<TSpec>): RouteDefinition<TSpec> {
	if (!handler) {
		return { method, handler, spec } as RouteDefinition<TSpec>;
	}

	// If spec is provided, wrap the handler with validation
	const wrappedHandler = spec
		? async (props: RouteProps<undefined>): Promise<Response> => {
				const logger = getLogger();
				const config = getConfig();
				// Validate and parse parameters according to spec
				const validatedProps = await validateAndParseParameters(props, spec);

				// Call the original handler with validated parameters
				const response = await handler(validatedProps as RouteProps<TSpec>);

				try {
					validateResponseAgainstSpec(response, spec, method);
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					logger.error(
						`OpenAPI spec validation failed for ${method.toUpperCase()}: ${errorMessage}`,
					);

					// In development, throw the error to help with debugging
					if (config.environment === "development") {
						throw error;
					}

					// In production, log but don't break the response
					// You might want to change this behavior based on your needs
				}

				return response;
			}
		: (handler as (props: RouteProps<undefined>) => Promise<Response>);

	return { method, handler: wrappedHandler, spec } as RouteDefinition<TSpec>;
}

/**
 * Validates and parses request parameters according to the provided spec
 */
async function validateAndParseParameters(
	props: RouteProps<undefined>,
	spec: SpecItem,
): Promise<RouteProps<undefined>> {
	const {
		request,
		params: rawParams,
		query: rawQuery,
		headers: rawHeaders,
		body: rawBody,
	} = props;

	const validatedProps: RouteProps<undefined> = {
		request,
		params: {},
		query: {},
		headers: {},
		body: undefined,
	};

	try {
		// Validate path parameters
		if (spec.parameters?.path) {
			const pathResult = spec.parameters.path.parse(rawParams || {});
			validatedProps.params = pathResult as Record<string, string>;
		} else {
			validatedProps.params = rawParams || {};
		}

		// Validate query parameters
		if (spec.parameters?.query) {
			const queryResult = spec.parameters.query.parse(rawQuery || {});
			validatedProps.query = queryResult as Record<string, string>;
		} else {
			validatedProps.query = rawQuery || {};
		}

		// Validate headers
		if (spec.parameters?.headers) {
			const headersResult = spec.parameters.headers.parse(rawHeaders || {});
			validatedProps.headers = headersResult as Record<string, string>;
		} else {
			validatedProps.headers = rawHeaders || {};
		}

		// Validate body (for POST/PUT/PATCH requests)
		if (spec.parameters?.body) {
			const bodyResult = spec.parameters.body.parse(rawBody);
			validatedProps.body = bodyResult;
		} else {
			validatedProps.body = rawBody;
		}

		return validatedProps;
	} catch (error) {
		// Handle validation errors
		if (error instanceof z.ZodError) {
			throw new Error(`Parameter validation failed: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Helper function to create route collections with multiple methods
 * This allows organizing multiple HTTP methods for the same path in one place
 */
export function createRouteCollection<
	TSpec extends SpecItem | undefined = undefined,
>(
	routes: Record<string, CreateRouteProps<TSpec>>,
): Record<string, RouteDefinition<TSpec>> {
	const collection: Record<string, RouteDefinition<TSpec>> = {};

	for (const [methodName, routeProps] of Object.entries(routes)) {
		const method = methodName.toUpperCase() as
			| "GET"
			| "POST"
			| "PUT"
			| "DELETE"
			| "PATCH";
		collection[method] = createRoute({ ...routeProps, method });
	}

	return collection;
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
		// Status code not defined in spec - this is an error
		const allowedStatusCodes = Object.keys(spec.responses).join(", ");
		throw new Error(
			`Response status ${statusCode} not defined in spec for ${method.toUpperCase()}. Allowed status codes: ${allowedStatusCodes}`,
		);
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
				throw new Error(
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
