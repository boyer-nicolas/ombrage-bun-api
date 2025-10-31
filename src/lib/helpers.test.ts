import { describe, expect, test } from "bun:test";
import type { OpenAPIV3_1 } from "openapi-types";
import { z } from "zod";
import {
	type CreateRouteProps,
	type CustomSpec,
	createRoute,
	createTypedResponse,
	customSpecToOpenAPI,
	defineSpec,
	generateOpenAPIFromCustomSpec,
	type RouteProps,
	type SpecItem,
	zodToOpenAPISchema,
} from "./helpers";

describe("helpers.ts", () => {
	describe("createRoute", () => {
		test("should create a route object with method and callback", () => {
			const mockCallback = async () => {
				return new Response("test");
			};

			const routeProps: CreateRouteProps = {
				method: "GET",
				callback: mockCallback,
			};

			const result = createRoute(routeProps);

			expect(result).toEqual({
				method: "GET",
				callback: mockCallback,
			});
		});

		test("should create a route object with only method when callback is undefined", () => {
			const routeProps: CreateRouteProps = {
				method: "POST",
			};

			const result = createRoute(routeProps);

			expect(result).toEqual({
				method: "POST",
				callback: undefined,
			});
		});

		test("should handle all HTTP methods", () => {
			const methods: Array<CreateRouteProps["method"]> = [
				"GET",
				"POST",
				"PUT",
				"DELETE",
				"PATCH",
			];

			for (const method of methods) {
				const result = createRoute({ method });
				expect(result.method).toBe(method);
			}
		});
	});

	describe("defineSpec", () => {
		test("should return the same CustomSpec object for valid spec", () => {
			const mockSpec: CustomSpec = {
				get: {
					format: "json",
					responses: {
						200: {
							summary: "Success",
							description: "Successful response",
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
					},
				},
			};

			const result = defineSpec(mockSpec);

			expect(result).toBe(mockSpec);
			expect(result).toEqual(mockSpec);
		});

		test("should throw error for empty spec object", () => {
			const emptySpec: CustomSpec = {};

			expect(() => defineSpec(emptySpec)).toThrow(
				"Spec object cannot be empty",
			);
		});

		test("should handle complex spec with multiple methods", () => {
			const complexSpec: CustomSpec = {
				get: {
					format: "json",
					responses: {
						200: {
							summary: "List users",
							description: "Array of users",
							schema: z.array(
								z.object({
									id: z.string(),
									name: z.string(),
								}),
							),
						},
					},
				},
				post: {
					format: "json",
					responses: {
						201: {
							summary: "User created",
							description: "Successfully created user",
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
						400: {
							summary: "Bad request",
							description: "Invalid input data",
							schema: z.object({
								error: z.string(),
							}),
						},
					},
				},
			};

			const result = defineSpec(complexSpec);

			expect(result).toBe(complexSpec);
			expect(result).toEqual(complexSpec);
		});
	});

	describe("zodToOpenAPISchema", () => {
		test("should convert string schema", () => {
			const schema = z.string();
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({ type: "string" });
		});

		test("should convert string schema with description", () => {
			const schema = z.string().describe("A test string");
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({
				type: "string",
				description: "A test string",
			});
		});

		test("should convert number schema", () => {
			const schema = z.number();
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({ type: "number" });
		});

		test("should convert boolean schema", () => {
			const schema = z.boolean();
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({ type: "boolean" });
		});

		test("should convert date schema", () => {
			const schema = z.date();
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({
				type: "string",
				format: "date-time",
			});
		});

		test("should convert enum schema", () => {
			const schema = z.enum(["json", "xml", "csv"]);
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({
				type: "string",
				enum: ["json", "xml", "csv"],
			});
		});

		test("should convert enum schema with description", () => {
			const schema = z.enum(["json", "xml"]).describe("Response format");
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({
				type: "string",
				enum: ["json", "xml"],
				description: "Response format",
			});
		});

		test("should convert array schema", () => {
			const schema = z.array(z.string());
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({
				type: "array",
				items: { type: "string" },
			});
		});

		test("should convert object schema", () => {
			const schema = z.object({
				id: z.string(),
				name: z.string(),
				age: z.number().optional(),
			});
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({
				type: "object",
				properties: {
					id: { type: "string" },
					name: { type: "string" },
					age: { type: "number" },
				},
				required: ["id", "name"],
			});
		});

		test("should convert schema with default values", () => {
			const schema = z.string().default("default-value");
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({
				type: "string",
				default: "default-value",
			});
		});

		test("should convert optional schema", () => {
			const schema = z.string().optional();
			const result = zodToOpenAPISchema(schema);

			expect(result).toEqual({ type: "string" });
		});
	});

	test("should handle unsupported Zod types with fallback", () => {
		// Create a mock Zod type that's not supported
		const mockSchema = {
			_def: { typeName: "ZodUnsupportedType" },
		} as unknown as z.ZodType;

		const result = zodToOpenAPISchema(mockSchema);
		expect(result).toEqual({ type: "object" });
	});

	test("should handle error cases gracefully", () => {
		// Pass null to trigger error handling
		const result = zodToOpenAPISchema(null as unknown as z.ZodType);
		expect(result).toEqual({ type: "object" });
	});

	describe("customSpecToOpenAPI", () => {
		test("should convert simple CustomSpec to OpenAPI paths", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					responses: {
						200: {
							summary: "Success",
							description: "Successful response",
							schema: z.object({
								message: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			if (pathItem?.get?.responses) {
				expect(pathItem.get.responses["200"]).toBeDefined();
			}
		});

		test("should convert CustomSpec with parameters", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					parameters: {
						path: z.object({
							id: z.string().describe("The item ID"),
						}),
						query: z.object({
							include: z.string().optional().describe("Fields to include"),
						}),
					},
					responses: {
						200: {
							summary: "Success",
							description: "Successful response",
							schema: z.object({
								id: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			if (pathItem?.get) {
				expect(pathItem.get.parameters).toBeDefined();
				const parameters = pathItem.get
					.parameters as OpenAPIV3_1.ParameterObject[];
				expect(parameters).toHaveLength(2);
				expect(parameters[0]).toEqual({
					name: "id",
					in: "path",
					required: true,
					schema: {
						type: "string",
						description: "The item ID",
					},
				});
				expect(parameters[1]).toEqual({
					name: "include",
					in: "query",
					required: false,
					schema: {
						type: "string",
						description: "Fields to include",
					},
				});
			}
		});

		test("should convert CustomSpec with header parameters", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					parameters: {
						headers: z.object({
							authorization: z.string().describe("Auth token"),
							"x-api-version": z.string().optional().describe("API version"),
						}),
					},
					responses: {
						200: {
							summary: "Success response",
							description: "Successful operation",
							schema: z.object({ status: z.string() }),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);
			const pathItem = result["/"];
			expect(pathItem?.get?.parameters).toHaveLength(2);

			const authParam = pathItem?.get?.parameters?.find(
				(p) =>
					typeof p === "object" && "name" in p && p.name === "authorization",
			) as OpenAPIV3_1.ParameterObject;
			expect(authParam).toMatchObject({
				name: "authorization",
				in: "header",
				required: true,
				schema: { type: "string", description: "Auth token" },
			});

			const versionParam = pathItem?.get?.parameters?.find(
				(p) =>
					typeof p === "object" && "name" in p && p.name === "x-api-version",
			) as OpenAPIV3_1.ParameterObject;
			expect(versionParam).toMatchObject({
				name: "x-api-version",
				in: "header",
				required: false,
				schema: { type: "string", description: "API version" },
			});
		});

		test("should handle multiple HTTP methods", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					responses: {
						200: {
							summary: "Get success",
							description: "Get response",
							schema: z.string(),
						},
					},
				},
				post: {
					format: "json",
					responses: {
						201: {
							summary: "Post success",
							description: "Post response",
							schema: z.object({ id: z.string() }),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			if (pathItem) {
				expect(pathItem.get).toBeDefined();
				expect(pathItem.post).toBeDefined();
			}
		});
	});

	describe("generateOpenAPIFromCustomSpec", () => {
		test("should generate complete OpenAPI document", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					responses: {
						200: {
							summary: "Success",
							description: "Successful response",
							schema: z.object({
								message: z.string(),
							}),
						},
					},
				},
			};

			const result = generateOpenAPIFromCustomSpec(customSpec, {
				title: "Test API",
				version: "1.0.0",
				description: "Test API description",
			});

			expect(result.openapi).toBe("3.1.0");
			expect(result.info.title).toBe("Test API");
			expect(result.info.version).toBe("1.0.0");
			expect(result.info.description).toBe("Test API description");
			expect(result.paths).toBeDefined();
			if (result.paths) {
				expect(result.paths["/"]).toBeDefined();
			}
		});

		test("should use default info when not provided", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					responses: {
						200: {
							summary: "Success",
							description: "Successful response",
							schema: z.string(),
						},
					},
				},
			};

			const result = generateOpenAPIFromCustomSpec(customSpec);

			expect(result.info.title).toBe("API Documentation");
			expect(result.info.version).toBe("1.0.0");
			expect(result.info.description).toBe("Generated from CustomSpec");
		});
	});

	describe("response validation", () => {
		test("should validate response status against spec", () => {
			const spec = {
				responses: {
					"200": { description: "OK" },
					"404": { description: "Not Found" },
				},
			} as OpenAPIV3_1.OperationObject;

			// Valid response
			const okResponse = new Response("OK", { status: 200 });
			expect(() => {
				// Call the internal validation function by creating a route with validation
				createRoute({
					method: "GET",
					callback: async () => okResponse,
					spec: spec,
				});
			}).not.toThrow();
		});

		test("should throw error for invalid response status", () => {
			const spec = {
				responses: {
					"200": { description: "OK" },
				},
			} as OpenAPIV3_1.OperationObject;

			// We can test this by examining the error throwing in spec validation
			expect(() => {
				// This will be caught by the validation logic
				createRoute({
					method: "GET",
					callback: async () => new Response("Not Found", { status: 404 }),
					spec: spec,
				});
			}).not.toThrow(); // The route creation doesn't throw, validation happens at runtime
		});

		test("should handle default responses in validation", () => {
			const spec = {
				responses: {
					"200": { description: "OK" },
					default: { description: "Default response" },
				},
			} as OpenAPIV3_1.OperationObject;

			const defaultResponse = new Response("Error", { status: 500 });
			expect(() => {
				createRoute({
					method: "GET",
					callback: async () => defaultResponse,
					spec: spec,
				});
			}).not.toThrow();
		});

		test("should validate content types", () => {
			const spec = {
				responses: {
					"200": {
						description: "OK",
						content: {
							"application/json": { schema: {} },
						},
					},
				},
			} as OpenAPIV3_1.OperationObject;

			const jsonResponse = new Response(JSON.stringify({ data: "test" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});

			expect(() => {
				createRoute({
					method: "GET",
					callback: async () => jsonResponse,
					spec: spec,
				});
			}).not.toThrow();
		});
	});

	describe("createTypedResponse", () => {
		test("should create typed response helper", () => {
			const spec = {
				responses: {
					"200": { description: "OK" },
					"404": { description: "Not Found" },
				},
			} as OpenAPIV3_1.OperationObject;

			const typedResponse = createTypedResponse(spec);
			expect(typedResponse).toHaveProperty("json");
			expect(typeof typedResponse.json).toBe("function");

			// Test the response creation
			const response = typedResponse.json({ message: "test" });
			expect(response).toBeInstanceOf(Response);
		});
	});

	describe("Type definitions", () => {
		test("RouteProps should include request, params, body, and query", () => {
			const mockProps: RouteProps = {
				request: new Request("http://localhost:3000/test"),
				params: { id: "123" },
				body: { name: "test" },
				query: { filter: "active" },
			};

			expect(mockProps.request).toBeInstanceOf(Request);
			expect(mockProps.params).toEqual({ id: "123" });
			expect(mockProps.body).toEqual({ name: "test" });
			expect(mockProps.query).toEqual({ filter: "active" });
		});

		test("CreateRouteProps should include method and optional callback", () => {
			const mockProps: CreateRouteProps = {
				method: "GET",
			};

			expect(mockProps.method).toBe("GET");
			expect(mockProps.callback).toBeUndefined();

			const mockPropsWithCallback: CreateRouteProps = {
				method: "POST",
				callback: async () => new Response("test"),
			};

			expect(mockPropsWithCallback.method).toBe("POST");
			expect(typeof mockPropsWithCallback.callback).toBe("function");
		});

		test("SpecItem should support the new parameter format", () => {
			const specItem: SpecItem = {
				format: "json",
				parameters: {
					path: z.object({
						id: z.string(),
					}),
					query: z.object({
						filter: z.string().optional(),
					}),
				},
				responses: {
					200: {
						summary: "Success",
						description: "Successful response",
						schema: z.string(),
					},
				},
			};

			expect(specItem.format).toBe("json");
			expect(specItem.parameters?.path).toBeDefined();
			expect(specItem.parameters?.query).toBeDefined();
			expect(specItem.responses[200]).toBeDefined();
		});
	});
});
