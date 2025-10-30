import type { OpenAPIV3_1 } from "openapi-types";

export function defineSpec(
	spec: OpenAPIV3_1.PathItemObject,
): OpenAPIV3_1.PathItemObject {
	if (!spec) {
		throw new Error("Spec object cannot be empty");
	}

	return spec;
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

// Enhanced RouteProps with typed request parameters and body
export type RouteProps<
	TSpec extends OpenAPIV3_1.OperationObject = OpenAPIV3_1.OperationObject,
> = {
	request: Request;
	params?: ExtractPathParams<TSpec>;
	body?: ExtractRequestBody<TSpec>;
	query?: ExtractQueryParams<TSpec>;
	validator?: unknown;
};

// Type helpers for extracting request parameters from spec
type ExtractPathParams<T extends OpenAPIV3_1.OperationObject> = T extends {
	parameters: readonly (infer P)[];
}
	? P extends { in: "path"; name: infer N; schema: { type: infer Type } }
		? N extends string
			? Type extends "string"
				? Record<N, string>
				: Type extends "number"
					? Record<N, number>
					: Record<N, unknown>
			: unknown
		: unknown
	: unknown;

type ExtractQueryParams<T extends OpenAPIV3_1.OperationObject> = T extends {
	parameters: readonly (infer P)[];
}
	? P extends { in: "query"; name: infer N; schema: { type: infer Type } }
		? N extends string
			? Type extends "string"
				? Record<N, string>
				: Type extends "number"
					? Record<N, number>
					: Record<N, unknown>
			: unknown
		: unknown
	: unknown;

type ExtractRequestBody<T extends OpenAPIV3_1.OperationObject> = T extends {
	requestBody: { content: { "application/json": { schema: infer Schema } } };
}
	? Schema
	: unknown;

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
	spec?: OpenAPIV3_1.OperationObject;
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
	spec: OpenAPIV3_1.OperationObject,
	method: string,
): void {
	if (!spec.responses) {
		return; // No spec to validate against
	}

	const statusCode = response.status.toString();
	const specResponse = spec.responses[statusCode];

	if (!specResponse) {
		// Check if there's a default response
		const defaultResponse = spec.responses.default;
		if (!defaultResponse) {
			const expectedStatuses = Object.keys(spec.responses).filter(
				(key) => key !== "default",
			);
			throw new Error(
				`Response status ${statusCode} is not defined in the OpenAPI spec for ${method.toUpperCase()} operation. Expected one of: ${expectedStatuses.join(", ")}`,
			);
		}
	}

	// Validate Content-Type if specified in the spec
	const responseSpec = specResponse || spec.responses.default;
	if (
		responseSpec &&
		typeof responseSpec === "object" &&
		"content" in responseSpec &&
		responseSpec.content
	) {
		const contentType = response.headers.get("Content-Type");
		const expectedContentTypes = Object.keys(responseSpec.content);

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
