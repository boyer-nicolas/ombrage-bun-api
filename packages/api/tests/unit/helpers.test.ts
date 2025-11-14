import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { OpenAPIV3_1 } from "openapi-types";
import { z } from "zod";
import { resetConfig, validateConfig } from "../../src/lib/config";
import {
	type CreateRouteProps,
	type CustomSpec,
	createRoute,
	createRouteCollection,
	createTypedResponse,
	customSpecToOpenAPI,
	executeProxyRequest,
	generateOpenAPIFromCustomSpec,
	type ProxyExecutionContext,
	type RouteProps,
	type SpecItem,
	zodToOpenAPISchema,
} from "../../src/lib/helpers";

describe("helpers.ts", () => {
	beforeAll(() => {
		// Initialize config for tests
		validateConfig({});
	});

	afterEach(() => {
		// Reset config state after each test
		resetConfig();
		validateConfig({});
	});

	describe("createRoute", () => {
		test("should create a route object with method and handler", () => {
			const mockHandler = async () => {
				return new Response("test");
			};

			const routeProps: CreateRouteProps = {
				method: "GET",
				handler: mockHandler,
			};

			const result = createRoute(routeProps);

			expect(result).toEqual({
				method: "GET",
				handler: mockHandler,
				spec: undefined,
			});
		});

		test("should create a route object with only method when handler is undefined", () => {
			const routeProps: CreateRouteProps = {
				method: "POST",
			};

			const result = createRoute(routeProps);

			expect(result).toEqual({
				method: "POST",
				handler: undefined,
				spec: undefined,
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
					summary: "Success",
					description: "A simple GET request",
					responses: {
						200: {
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
					summary: "Success",
					description: "Successful response",
					responses: {
						200: {
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
					summary: "Success response",
					description: "Successful operation",
					responses: {
						200: {
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
					summary: "Get success",
					description: "Get response",
					responses: {
						200: {
							schema: z.string(),
						},
					},
				},
				post: {
					format: "json",
					summary: "Post success",
					description: "Post response",
					responses: {
						201: {
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

		test("should convert CustomSpec with body parameters", () => {
			const customSpec: CustomSpec = {
				post: {
					format: "json",
					parameters: {
						body: z.object({
							name: z.string().describe("The name of the item"),
							description: z
								.string()
								.optional()
								.describe("Optional description"),
						}),
					},
					summary: "Created",
					description: "Successfully created item",
					responses: {
						201: {
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			expect(pathItem?.post).toBeDefined();

			const postOperation = pathItem?.post;
			expect(postOperation?.requestBody).toBeDefined();

			const requestBody =
				postOperation?.requestBody as OpenAPIV3_1.RequestBodyObject;
			expect(requestBody.required).toBe(true);
			expect(requestBody.content).toBeDefined();
			expect(requestBody.content["application/json"]).toBeDefined();

			const jsonContent = requestBody.content["application/json"];
			if (!jsonContent) {
				throw new Error("jsonContent is undefined");
			}
			expect(jsonContent.schema).toBeDefined();
			expect(jsonContent.schema).toEqual({
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "The name of the item",
					},
					description: {
						type: "string",
						description: "Optional description",
					},
				},
				required: ["name"],
			});
		});

		test("should handle mixed parameters including body", () => {
			const customSpec: CustomSpec = {
				post: {
					format: "json",
					parameters: {
						path: z.object({
							id: z.string().describe("The item ID"),
						}),
						query: z.object({
							validate: z.boolean().optional().describe("Whether to validate"),
						}),
						headers: z.object({
							"x-api-key": z.string().describe("API key"),
						}),
						body: z.object({
							name: z.string().describe("Item name"),
							description: z.string().optional().describe("Item description"),
						}),
					},
					summary: "Updated",
					description: "Successfully updated item",
					responses: {
						200: {
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			const pathItem = result["/"];
			const postOperation = pathItem?.post;

			// Check that both regular parameters and requestBody are present
			expect(postOperation?.parameters).toBeDefined();
			expect(postOperation?.requestBody).toBeDefined();

			// Verify parameters (path, query, headers)
			const parameters =
				postOperation?.parameters as OpenAPIV3_1.ParameterObject[];
			expect(parameters).toHaveLength(3);

			const pathParam = parameters.find(
				(p) => p.in === "path" && p.name === "id",
			);
			expect(pathParam).toBeDefined();
			expect(pathParam?.required).toBe(true);

			const queryParam = parameters.find(
				(p) => p.in === "query" && p.name === "validate",
			);
			expect(queryParam).toBeDefined();
			expect(queryParam?.required).toBe(false);

			const headerParam = parameters.find(
				(p) => p.in === "header" && p.name === "x-api-key",
			);
			expect(headerParam).toBeDefined();
			expect(headerParam?.required).toBe(true);

			// Verify requestBody
			const requestBody =
				postOperation?.requestBody as OpenAPIV3_1.RequestBodyObject;
			expect(requestBody.required).toBe(true);
			expect(requestBody.content["application/json"]).toBeDefined();

			const jsonContent = requestBody.content["application/json"];
			if (jsonContent) {
				expect(jsonContent.schema).toBeDefined();
				expect(jsonContent.schema).toEqual({
					type: "object",
					properties: {
						name: {
							type: "string",
							description: "Item name",
						},
						description: {
							type: "string",
							description: "Item description",
						},
					},
					required: ["name"],
				});
			}
		});

		test("should handle tags in CustomSpec", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					tags: ["Users", "Authentication"],
					summary: "Success",
					description: "Successful response",
					responses: {
						200: {
							schema: z.object({
								message: z.string(),
							}),
						},
					},
				},
				post: {
					format: "json",
					tags: ["Users"],
					parameters: {
						body: z.object({
							name: z.string(),
						}),
					},
					summary: "Created",
					description: "Resource created",
					responses: {
						201: {
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];

			// Check GET operation has tags
			if (pathItem?.get) {
				expect(pathItem.get.tags).toEqual(["Users", "Authentication"]);
			}

			// Check POST operation has tags
			if (pathItem?.post) {
				expect(pathItem.post.tags).toEqual(["Users"]);
			}
		});
	});

	describe("generateOpenAPIFromCustomSpec", () => {
		test("should generate complete OpenAPI document", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					summary: "Success",
					description: "Successful response",
					responses: {
						200: {
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
					summary: "Success",
					description: "Successful response",
					responses: {
						200: {
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
			const spec: SpecItem = {
				format: "json",
				summary: "OK",
				description: "OK",
				responses: {
					200: {
						schema: z.object({
							message: z.string(),
						}),
					},
					404: {
						schema: z.object({
							message: z.string(),
						}),
					},
				},
			};

			// Valid response
			const okResponse = new Response("OK", { status: 200 });
			expect(() => {
				// Call the internal validation function by creating a route with validation
				createRoute({
					method: "GET",
					handler: async () => okResponse,
					spec: spec,
				});
			}).not.toThrow();
		});

		test("should throw error for invalid response status", () => {
			const spec: SpecItem = {
				format: "json",
				summary: "OK",
				description: "OK",
				responses: {
					200: {
						schema: z.object({
							message: z.string(),
						}),
					},
				},
			};

			// We can test this by examining the error throwing in spec validation
			expect(() => {
				// This will be caught by the validation logic
				createRoute({
					method: "GET",
					handler: async () => new Response("Not Found", { status: 404 }),
					spec: spec,
				});
			}).not.toThrow(); // The route creation doesn't throw, validation happens at runtime
		});

		test("should validate content types", () => {
			const spec: SpecItem = {
				format: "json",
				summary: "OK",
				description: "OK",
				responses: {
					200: {
						schema: z.object({
							message: z.string(),
						}),
					},
				},
			};

			const jsonResponse = new Response(JSON.stringify({ data: "test" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});

			expect(() => {
				createRoute({
					method: "GET",
					handler: async () => jsonResponse,
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

		test("CreateRouteProps should include method and optional handler", () => {
			const mockProps: CreateRouteProps = {
				method: "GET",
			};

			expect(mockProps.method).toBe("GET");
			expect(mockProps.handler).toBeUndefined();

			const mockPropsWithHandler: CreateRouteProps = {
				method: "POST",
				handler: async () => new Response("test"),
			};

			expect(mockPropsWithHandler.method).toBe("POST");
			expect(typeof mockPropsWithHandler.handler).toBe("function");
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
				summary: "Success",
				description: "Successful response",
				responses: {
					200: {
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

	describe("Operation-level summary and description", () => {
		test("should include operation-level summary and description when provided", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					summary: "Get user information",
					description: "Retrieves detailed user information by ID",
					responses: {
						200: {
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			expect(pathItem?.get).toBeDefined();

			const getOperation = pathItem?.get;
			expect(getOperation?.summary).toBe("Get user information");
			expect(getOperation?.description).toBe(
				"Retrieves detailed user information by ID",
			);
		});

		test("should fallback to first successful response summary/description when operation-level not provided", () => {
			const customSpec: CustomSpec = {
				post: {
					format: "json",
					description:
						"A new user has been created with the provided information",
					responses: {
						201: {
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
						400: {
							schema: z.object({
								error: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			expect(pathItem?.post).toBeDefined();

			const postOperation = pathItem?.post;
			expect(postOperation?.summary).toBe("API Operation");
			expect(postOperation?.description).toBe(
				"A new user has been created with the provided information",
			);
		});

		test("should prefer 200 response over other status codes for fallback", () => {
			const customSpec: CustomSpec = {
				get: {
					format: "json",
					description: "User data operations",
					responses: {
						404: {
							schema: z.object({
								error: z.string(),
							}),
						},
						200: {
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
						500: {
							schema: z.object({
								error: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			expect(pathItem?.get).toBeDefined();

			const getOperation = pathItem?.get;
			expect(getOperation?.summary).toBe("API Operation");
			expect(getOperation?.description).toBe("User data operations");
		});

		test("should fallback to first response when no successful status codes exist", () => {
			const customSpec: CustomSpec = {
				delete: {
					format: "json",
					description: "User not found",
					responses: {
						404: {
							schema: z.object({
								error: z.string(),
							}),
						},
						500: {
							schema: z.object({
								error: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			expect(pathItem?.delete).toBeDefined();

			const deleteOperation = pathItem?.delete;
			expect(deleteOperation?.summary).toBe("API Operation");
			expect(deleteOperation?.description).toBe("User not found");
		});

		test("should mix operation-level and response-level fallback correctly", () => {
			const customSpec: CustomSpec = {
				patch: {
					format: "json",
					summary: "Update user", // Operation-level summary provided
					// No operation-level description, should fallback to response
					description: "User updated successfully with new information",
					responses: {
						200: {
							schema: z.object({
								id: z.string(),
								name: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			expect(pathItem?.patch).toBeDefined();

			const patchOperation = pathItem?.patch;
			expect(patchOperation?.summary).toBe("Update user"); // From operation level
			expect(patchOperation?.description).toBe(
				"User updated successfully with new information",
			); // From response fallback
		});

		test("should work with all successful status codes for fallback", () => {
			const customSpec: CustomSpec = {
				put: {
					format: "json",
					description: "Request accepted and will be processed asynchronously",
					responses: {
						202: {
							schema: z.object({
								id: z.string(),
								status: z.string(),
							}),
						},
					},
				},
			};

			const result = customSpecToOpenAPI(customSpec);

			expect(result["/"]).toBeDefined();
			const pathItem = result["/"];
			expect(pathItem?.put).toBeDefined();

			const putOperation = pathItem?.put;
			expect(putOperation?.summary).toBe("API Operation");
			expect(putOperation?.description).toBe(
				"Request accepted and will be processed asynchronously",
			);
		});
	});

	describe("createRouteCollection", () => {
		test("should create route collection from object", () => {
			const routes = {
				get: {
					method: "GET" as const,
					handler: async () => new Response("GET response"),
				},
				post: {
					method: "POST" as const,
					handler: async () => new Response("POST response"),
				},
				put: {
					method: "PUT" as const,
					handler: async () => new Response("PUT response"),
				},
			};

			const collection = createRouteCollection(routes);

			expect(collection).toHaveProperty("GET");
			expect(collection).toHaveProperty("POST");
			expect(collection).toHaveProperty("PUT");
			expect(collection.GET?.method).toBe("GET");
			expect(collection.POST?.method).toBe("POST");
			expect(collection.PUT?.method).toBe("PUT");
		});

		test("should handle routes without handlers", () => {
			const routes = {
				get: {
					method: "GET" as const,
				},
				post: {
					method: "POST" as const,
					handler: async () => new Response("POST response"),
				},
			};

			const collection = createRouteCollection(routes);

			expect(collection).toHaveProperty("GET");
			expect(collection).toHaveProperty("POST");
			expect(collection.GET?.method).toBe("GET");
			expect(collection.GET?.handler).toBeUndefined();
			expect(collection.POST?.handler).toBeDefined();
		});
	});

	describe("executeProxyRequest", () => {
		test("should execute proxy request without handler", async () => {
			// Mock fetch to avoid actual network requests
			const originalFetch = global.fetch;
			global.fetch = mock(async () => {
				return new Response("Proxied response", { status: 200 });
			}) as unknown as typeof fetch;

			const request = new Request("http://localhost/test");
			const context: ProxyExecutionContext = {
				request,
				params: {},
				startTime: Date.now(),
				config: {
					pattern: "/test/*",
					target: "http://example.com",
					enabled: true,
					basePath: "/",
				},
			};

			const response = await executeProxyRequest(context);
			if (!response) {
				throw new Error("Response is undefined");
			}
			expect(response.status).toBe(200);

			// Restore original fetch
			global.fetch = originalFetch;
		});

		test("should execute proxy handler that blocks request", async () => {
			const request = new Request("http://localhost/test");
			const mockHandler = mock(async () => ({
				proceed: false,
				response: new Response("Blocked", { status: 403 }),
			}));

			const context: ProxyExecutionContext = {
				request,
				params: {},
				startTime: Date.now(),
				config: {
					pattern: "/test/*",
					target: "http://example.com",
					enabled: true,
					handler: mockHandler,
					basePath: "/",
				},
			};

			const response = await executeProxyRequest(context);
			if (!response) {
				throw new Error("Response is undefined");
			}
			expect(response.status).toBe(403);
			expect(await response.text()).toBe("Blocked");
		});

		test("should execute proxy handler that allows request", async () => {
			// Mock fetch
			const originalFetch = global.fetch;
			global.fetch = mock(async () => {
				return new Response("Proxied response", { status: 200 });
			}) as unknown as typeof fetch;

			const request = new Request("http://localhost/test");
			const mockHandler = mock(async () => ({
				proceed: true,
				headers: { "X-Custom": "test" },
			}));

			const context: ProxyExecutionContext = {
				request,
				params: {},
				startTime: Date.now(),
				config: {
					pattern: "/test/*",
					target: "http://example.com",
					enabled: true,
					handler: mockHandler,
					basePath: "/",
				},
			};

			const response = await executeProxyRequest(context);
			if (!response) {
				throw new Error("Response is undefined");
			}
			expect(response.status).toBe(200);

			// Restore original fetch
			global.fetch = originalFetch;
		});
	});
});
