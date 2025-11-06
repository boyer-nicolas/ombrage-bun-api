import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateConfig } from "../../src/lib/config";
import { FileRouter } from "../../src/lib/router";

describe("router.ts", () => {
	let router: FileRouter;
	let originalFetch: typeof global.fetch;

	beforeEach(() => {
		// Store original fetch so we can restore it
		originalFetch = global.fetch;

		router = new FileRouter(
			validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
			}),
		);
	});

	afterEach(() => {
		// Restore original fetch to prevent test pollution
		global.fetch = originalFetch;
	});
	describe("FileRouter constructor", () => {
		test("should initialize with default routes path", () => {
			expect(router).toBeInstanceOf(FileRouter);
		});

		test("should initialize with custom routes path", () => {
			const config = validateConfig({
				server: {
					routes: {
						dir: "./custom/routes",
					},
				},
			});
			const customRouter = new FileRouter(config);
			expect(customRouter).toBeInstanceOf(FileRouter);
		});
	});

	describe("handleRequest", () => {
		test("should handle GET request successfully", async () => {
			const mockHandler = mock(async () => new Response("Hello World"));

			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { method: "GET", handler: mockHandler },
				},
			});

			const request = new Request("http://localhost:3000/test", {
				method: "GET",
			});
			const response = await router.handleRequest(request);

			expect(mockHandler).toHaveBeenCalledWith({
				request,
				params: {},
				body: undefined,
				query: {},
				headers: {},
			});
			expect(await response.text()).toBe("Hello World");
		});

		test("should handle POST request with body", async () => {
			const mockHandler = mock(async ({ body }: { body?: unknown }) => {
				return Response.json({ received: body });
			});

			router.routes.set("/api/users", {
				path: "/api/users",
				routeFile: "/path/to/route.ts",
				routes: {
					POST: { method: "POST", handler: mockHandler },
				},
			});

			const request = new Request("http://localhost:3000/api/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "John" }),
			});

			const response = await router.handleRequest(request);
			const result = await response.json();

			expect(mockHandler).toHaveBeenCalledWith({
				request,
				params: {},
				body: { name: "John" },
				query: {},
				headers: { "content-type": "application/json" },
			});
			expect(result).toEqual({ received: { name: "John" } });
		});

		test("should return 404 for non-existent route", async () => {
			const request = new Request("http://localhost:3000/nonexistent", {
				method: "GET",
			});
			const response = await router.handleRequest(request);

			expect(response.status).toBe(404);
			const result = await response.json();
			expect(result).toEqual({
				error: "Not Found",
				message: "Route /nonexistent not found",
				status: 404,
			});
		});

		test("should return 405 for unsupported HTTP method", async () => {
			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: {
						method: "GET",
						handler: async () => new Response("GET only"),
					},
				},
			});

			const request = new Request("http://localhost:3000/test", {
				method: "POST",
			});
			const response = await router.handleRequest(request);

			expect(response.status).toBe(405);
			const result = await response.json();
			expect(result).toEqual({
				error: "Method Not Allowed",
				message: "Method POST not allowed for /test",
				status: 405,
			});
		});

		test("should return 405 when route has no handler", async () => {
			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { method: "GET" }, // No handler
				},
			});

			const request = new Request("http://localhost:3000/test", {
				method: "GET",
			});
			const response = await router.handleRequest(request);

			expect(response.status).toBe(405);
			const result = await response.json();
			expect(result).toEqual({
				error: "Method Not Allowed",
				message: "Method GET not implemented for /test",
				status: 405,
			});
		});

		test("should handle dynamic routes with parameters", async () => {
			const mockHandler = mock(
				async ({ params }: { params?: Record<string, string> }) => {
					return Response.json({ id: params?.id, message: "Found" });
				},
			);

			router.routes.set("/users/[id]", {
				path: "/users/[id]",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { handler: mockHandler },
				},
			});

			const request = new Request("http://localhost:3000/users/123", {
				method: "GET",
			});
			const response = await router.handleRequest(request);

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result).toEqual({ id: "123", message: "Found" });
			expect(mockHandler).toHaveBeenCalledWith({
				request,
				params: { id: "123" },
				body: undefined,
				query: {},
				headers: {},
			});
		});

		test("should handle multiple dynamic parameters", async () => {
			const mockHandler = mock(
				async ({ params }: { params?: Record<string, string> }) => {
					return Response.json({
						userId: params?.userId,
						postId: params?.postId,
					});
				},
			);

			router.routes.set("/users/[userId]/posts/[postId]", {
				path: "/users/[userId]/posts/[postId]",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { handler: mockHandler },
				},
			});

			const request = new Request("http://localhost:3000/users/123/posts/456", {
				method: "GET",
			});
			const response = await router.handleRequest(request);

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result).toEqual({ userId: "123", postId: "456" });
			expect(mockHandler).toHaveBeenCalledWith({
				request,
				params: { userId: "123", postId: "456" },
				body: undefined,
				query: {},
				headers: {},
			});
		});

		test("should handle query parameters", async () => {
			const mockHandler = mock(
				async ({ query }: { query?: Record<string, string> }) => {
					return Response.json({ filter: query?.filter, sort: query?.sort });
				},
			);

			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { handler: mockHandler },
				},
			});

			const request = new Request(
				"http://localhost:3000/test?filter=active&sort=name",
				{
					method: "GET",
				},
			);
			const response = await router.handleRequest(request);

			expect(response.status).toBe(200);
			const result = await response.json();
			expect(result).toEqual({ filter: "active", sort: "name" });
			expect(mockHandler).toHaveBeenCalledWith({
				request,
				params: {},
				body: undefined,
				query: { filter: "active", sort: "name" },
				headers: {},
			});
		});

		test("should return 500 on handler error", async () => {
			const mockHandler = mock(async () => {
				throw new Error("Handler error");
			});

			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { method: "GET", handler: mockHandler },
				},
			});

			const request = new Request("http://localhost:3000/test", {
				method: "GET",
			});
			const response = await router.handleRequest(request);

			expect(response.status).toBe(500);
			const result = await response.json();
			expect(result).toEqual({
				error: "Internal Server Error",
				message: "An unexpected error occurred",
				status: 500,
			});
		});

		test("should find best matching route for nested paths", async () => {
			const handler = mock(async () => new Response("Found"));

			router.routes.set("/api/users", {
				path: "/api/users",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { method: "GET", handler },
				},
			});

			const request = new Request("http://localhost:3000/api/users/123", {
				method: "GET",
			});
			const response = await router.handleRequest(request);

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("Found");
		});
	});

	describe("generateOpenAPISpec", () => {
		test("should generate basic OpenAPI spec", async () => {
			const spec = await router.generateOpenAPISpec();

			expect(spec).toHaveProperty("openapi", "3.1.0");
			expect(spec).toHaveProperty("info");
			expect(spec.info).toHaveProperty("title", "My API");
			expect(spec).toHaveProperty("paths");
		});

		test("should include route specs in generated OpenAPI spec", async () => {
			const mockRoutes = {
				GET: {
					method: "GET",
					handler: async () => Response.json({}),
					spec: {
						format: "json",
						responses: {
							200: {
								description: "Success",
							},
						},
					},
				},
			};

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
			});

			const router = new FileRouter(config);
			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: mockRoutes,
			});

			const spec = await router.generateOpenAPISpec();

			expect(spec.paths).toBeDefined();
			if (spec.paths) {
				expect(spec.paths).toHaveProperty("/test");
				expect(spec.paths["/test"]).toHaveProperty("get");
			}
		});

		test("should add 500 error response to operations without one", async () => {
			const mockRoutes = {
				GET: {
					method: "GET",
					handler: async () => Response.json({}),
					spec: {
						format: "json",
						responses: {
							200: {
								summary: "Test endpoint",
								description: "Success",
								schema: { type: "object" },
							},
						},
					},
				},
			};

			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: mockRoutes,
			});

			const spec = await router.generateOpenAPISpec();

			expect(spec.paths?.["/test"]?.get?.responses?.["500"]).toEqual({
				description: "Internal server error",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								error: {
									type: "string",
								},
								message: {
									type: "string",
									default: "An unexpected error occurred",
								},
							},
						},
					},
				},
			});
		});

		test("should collect and include tags in OpenAPI spec", async () => {
			const mockRoutesWithTags = {
				GET: {
					method: "GET",
					handler: async () => Response.json({}),
					spec: {
						format: "json",
						tags: ["Users", "Authentication"],
						responses: {
							200: {
								summary: "Get users",
								description: "Get all users",
								schema: { type: "object" },
							},
						},
					},
				},
				POST: {
					method: "POST",
					handler: async () => Response.json({}),
					spec: {
						format: "json",
						tags: ["Users"],
						responses: {
							201: {
								summary: "Create user",
								description: "User created",
								schema: { type: "object" },
							},
						},
					},
				},
			};

			const mockHealthRoutes = {
				GET: {
					method: "GET",
					handler: async () => Response.json({}),
					spec: {
						format: "json",
						tags: ["Health"],
						responses: {
							200: {
								summary: "Health check",
								description: "Health status",
								schema: { type: "object" },
							},
						},
					},
				},
			};

			router.routes.set("/users", {
				path: "/users",
				routeFile: "/path/to/users/route.ts",
				routes: mockRoutesWithTags,
			});

			router.routes.set("/health", {
				path: "/health",
				routeFile: "/path/to/health/route.ts",
				routes: mockHealthRoutes,
			});

			const spec = await router.generateOpenAPISpec();

			// Check that tags section exists
			expect(spec.tags).toBeDefined();
			expect(spec.tags).toHaveLength(3);

			// Check that tags are sorted alphabetically
			const expectedTags = [
				{
					name: "Authentication",
					description: "Operations related to authentication",
				},
				{ name: "Health", description: "Operations related to health" },
				{ name: "Users", description: "Operations related to users" },
			];
			expect(spec.tags).toEqual(expectedTags);

			// Check that operations have the correct tags
			const usersGetOp = spec.paths?.["/users"]?.get;
			const usersPostOp = spec.paths?.["/users"]?.post;
			const healthGetOp = spec.paths?.["/health"]?.get;

			expect(usersGetOp?.tags).toEqual(["Users", "Authentication"]);
			expect(usersPostOp?.tags).toEqual(["Users"]);
			expect(healthGetOp?.tags).toEqual(["Health"]);
		});
	});

	describe("handleSwaggerRequest", () => {
		test("should return Swagger UI HTML for root path", async () => {
			const response = await router.handleSwaggerRequest("/");

			expect(response).toBeInstanceOf(Response);
			expect(response?.headers.get("Content-Type")).toBe("text/html");
		});

		test("should return OpenAPI JSON for api-docs.json", async () => {
			const response = await router.handleSwaggerRequest("/api-docs.json");

			expect(response).toBeInstanceOf(Response);
			expect(response?.headers.get("Content-Type")).toBe(
				"application/json;charset=utf-8",
			);
		});

		test("should return null for non-swagger paths", async () => {
			const response = await router.handleSwaggerRequest("/other");
			expect(response).toBeNull();
		});
	});

	describe("getRouteInfo", () => {
		test("should return route information for debugging", () => {
			const mockRoutesWithSpec = {
				GET: {
					method: "GET",
					handler: async () => Response.json({}),
					spec: {
						format: "json",
						responses: {
							200: {
								summary: "Test endpoint",
								description: "Success",
								schema: { type: "object" },
							},
						},
					},
				},
			};

			router.routes.set("/test", {
				path: "/test",
				routeFile: "/path/to/route.ts",
				routes: mockRoutesWithSpec,
			});
			router.routes.set("/test2", {
				path: "/test2",
				routeFile: "/path/to/route2.ts",
				routes: {
					GET: {
						method: "GET",
						handler: async () => Response.json({}),
						// No spec
					},
				},
			});

			const routeInfo = router.getRouteInfo();

			expect(routeInfo).toEqual(["/test", "/test2"]);
		});

		test("should return empty array when no routes discovered", () => {
			const routeInfo = router.getRouteInfo();
			expect(routeInfo).toEqual([]);
		});
	});

	describe("getRoutes", () => {
		test("should return a map of all discovered routes", async () => {
			// Create a temporary directory structure for testing
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "router-test-"));
			const config = validateConfig({
				server: {
					routes: {
						dir: tempDir,
					},
				},
			});
			const router = new FileRouter(config);

			const routes = router.getRoutes();
			expect(routes).toBeInstanceOf(Map);

			// Clean up
			await fs.rm(tempDir, { recursive: true, force: true });
		});
	});

	describe("private method coverage", () => {
		test("should handle spec modules with various export formats", async () => {
			// Create a temporary directory structure for testing
			const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "router-test-"));
			const config = validateConfig({
				server: {
					routes: {
						dir: tempDir,
					},
				},
			});
			const router = new FileRouter(config);

			// Test by trying to load routes which will exercise getSpecData internally
			await router.discoverRoutes();
			await router.loadRoutes();

			// This will exercise the getSpecData method through the normal flow
			const spec = router.generateOpenAPISpec();
			expect(spec).toBeDefined();

			// Clean up
			await fs.rm(tempDir, { recursive: true, force: true });
		});
	});

	describe("getSwaggerUIHTML", () => {
		test("should return valid HTML string", () => {
			const html = router.getSwaggerUIHTML();
			expect(typeof html).toBe("string");
			expect(html).toContain("<!DOCTYPE html>");
			expect(html).toContain("swagger-ui");
		});

		test("should include API title in HTML", () => {
			const html = router.getSwaggerUIHTML();
			expect(html).toContain("My API Documentation");
		});
	});

	describe("path matching", () => {
		test("should match exact paths first", async () => {
			const exactHandler = mock(async () => new Response("Exact match"));

			router.routes.set("/api/users", {
				path: "/api/users",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { method: "GET", handler: exactHandler },
				},
			});

			const request = new Request("http://localhost:3000/api/users", {
				method: "GET",
			});
			await router.handleRequest(request);

			expect(exactHandler).toHaveBeenCalled();
		});

		test("should fall back to parent route when exact match not found", async () => {
			const parentHandler = mock(async () => new Response("Parent match"));

			router.routes.set("/api", {
				path: "/api",
				routeFile: "/path/to/route.ts",
				routes: {
					GET: { method: "GET", handler: parentHandler },
				},
			});

			const request = new Request("http://localhost:3000/api/users/123", {
				method: "GET",
			});
			await router.handleRequest(request);

			expect(parentHandler).toHaveBeenCalled();
		});
	});

	describe("handleStaticRequest", () => {
		test("should handle static requests when static directory exists but serving disabled", async () => {
			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
					// Static config gets defaults: { dir: "./static", enabled: false, basePath: "/static" }
				},
			});
			const router = new FileRouter(config);

			// Since static serving is disabled, this should still work (directory exists)
			// but will return 404 for non-existent file
			const response = await router.handleStaticRequest("/test.txt");
			expect(response.status).toBe(404);
		});

		test("should serve static file successfully", async () => {
			// Create a temporary directory and file for testing
			const tempDir = await fs.mkdtemp(
				path.join(os.tmpdir(), "ombrage-static-test-"),
			);
			const testFile = path.join(tempDir, "test.txt");
			await fs.writeFile(testFile, "Hello, World!");

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
					static: {
						dir: tempDir,
						enabled: true,
					},
				},
			});
			const router = new FileRouter(config);

			const response = await router.handleStaticRequest("/test.txt");

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("Hello, World!");
			expect(response.headers.get("Content-Type")).toContain("text/plain");

			// Cleanup
			await fs.unlink(testFile);
			await fs.rmdir(tempDir);
		});

		test("should return 404 for non-existent static file", async () => {
			const tempDir = await fs.mkdtemp(
				path.join(os.tmpdir(), "ombrage-static-test-"),
			);

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
					static: {
						dir: tempDir,
						enabled: true,
					},
				},
			});
			const router = new FileRouter(config);

			const response = await router.handleStaticRequest("/nonexistent.txt");

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("Not Found");

			// Cleanup
			await fs.rmdir(tempDir);
		});

		test("should handle file system errors gracefully", async () => {
			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
					static: {
						dir: "/invalid/directory/that/does/not/exist",
						enabled: true,
					},
				},
			});
			const router = new FileRouter(config);

			const response = await router.handleStaticRequest("/test.txt");

			expect(response.status).toBe(404);
			expect(await response.text()).toBe("Not Found");
		});

		test("should set appropriate content type for different file types", async () => {
			const tempDir = await fs.mkdtemp(
				path.join(os.tmpdir(), "ombrage-static-test-"),
			);
			const jsonFile = path.join(tempDir, "data.json");
			await fs.writeFile(jsonFile, '{"test": true}');

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
					static: {
						dir: tempDir,
						enabled: true,
					},
				},
			});
			const router = new FileRouter(config);

			const response = await router.handleStaticRequest("/data.json");

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toContain(
				"application/json",
			);

			// Cleanup
			await fs.unlink(jsonFile);
			await fs.rmdir(tempDir);
		});
	});

	describe("mergeExternalSpecs", () => {
		test("should handle missing external specs configuration", async () => {
			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
				// No swagger.externalSpecs configuration
			});
			const router = new FileRouter(config);

			const baseSpec = {
				openapi: "3.1.0",
				info: { title: "Test API", version: "1.0.0" },
				paths: {},
			};
			const allTags = new Set<string>();

			// Should not throw and should not modify the spec
			await router["mergeExternalSpecs"](baseSpec, allTags);

			expect(baseSpec.paths).toEqual({});
		});

		test.skip("should handle failed external spec fetch", async () => {
			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
				swagger: {
					externalSpecs: [
						{
							name: "Test External API",
							url: "https://httpbin.org/status/500",
						},
					],
				},
			});
			const router = new FileRouter(config);

			const baseSpec = {
				openapi: "3.1.0",
				info: { title: "Test API", version: "1.0.0" },
				paths: {},
			};
			const allTags = new Set<string>();

			// Should not throw even if external spec fetch fails
			await router["mergeExternalSpecs"](baseSpec, allTags);

			expect(baseSpec.paths).toEqual({});
		});

		test.skip("should merge JSON external spec successfully", async () => {
			// Mock fetch for JSON response
			const originalFetch = global.fetch;
			global.fetch = mock(async () => {
				return new Response(
					JSON.stringify({
						openapi: "3.1.0",
						info: { title: "External API", version: "1.0.0" },
						paths: {
							"/external/test": {
								get: {
									summary: "External test endpoint",
									responses: { 200: { description: "Success" } },
								},
							},
						},
						tags: [{ name: "External", description: "External endpoints" }],
					}),
					{
						headers: { "content-type": "application/json" },
						status: 200,
					},
				);
			}) as unknown as typeof fetch;

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
				swagger: {
					externalSpecs: [
						{
							name: "Test External API",
							url: "http://example.com/openapi.json",
						},
					],
				},
			});
			const router = new FileRouter(config);

			const baseSpec = {
				openapi: "3.1.0" as const,
				info: { title: "Test API", version: "1.0.0" },
				paths: {},
				tags: [] as Array<{ name: string; description: string }>,
			};
			const allTags = new Set<string>();

			await router["mergeExternalSpecs"](baseSpec, allTags);

			expect(baseSpec.paths).toHaveProperty("/external/test");
			expect(baseSpec.tags).toContainEqual({
				name: "External",
				description: "External endpoints",
			});
			expect(allTags.has("External")).toBe(true);

			// Restore original fetch
			global.fetch = originalFetch;
		});

		test.skip("should parse external spec from HTML response", async () => {
			// Mock fetch for HTML response (like Better Auth)
			const originalFetch = global.fetch;
			global.fetch = mock(async () => {
				const htmlContent = `
					<html>
						<head><title>API Docs</title></head>
						<body>
							<script>
								const spec = {"openapi":"3.1.0","info":{"title":"Auth API","version":"1.0.0"},"paths":{"/auth/login":{"post":{"summary":"Login endpoint","responses":{"200":{"description":"Success"}}}}},"tags":[{"name":"Auth","description":"Authentication"}]};
							</script>
						</body>
					</html>
				`;
				return new Response(htmlContent, {
					headers: { "content-type": "text/html" },
					status: 200,
				});
			}) as unknown as typeof fetch;

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
				swagger: {
					externalSpecs: [
						{
							name: "Auth API",
							url: "http://example.com/auth/openapi",
						},
					],
				},
			});
			const router = new FileRouter(config);

			const baseSpec = {
				openapi: "3.1.0",
				info: { title: "Test API", version: "1.0.0" },
				paths: {},
				tags: [] as Array<{ name: string; description: string }>,
			};
			const allTags = new Set<string>();

			await router["mergeExternalSpecs"](baseSpec, allTags);

			expect(baseSpec.paths).toHaveProperty("/auth/login");
			expect(baseSpec.tags).toContainEqual({
				name: "Auth",
				description: "Authentication",
			});

			// Restore original fetch
			global.fetch = originalFetch;
		});

		test("should handle HTML response without valid JSON", async () => {
			// Mock fetch for HTML response without valid OpenAPI JSON
			const originalFetch = global.fetch;
			global.fetch = mock(async () => {
				return new Response(
					"<html><body><h1>API Documentation</h1><p>No JSON here</p></body></html>",
					{
						headers: { "content-type": "text/html" },
						status: 200,
					},
				);
			}) as unknown as typeof fetch;

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
				swagger: {
					externalSpecs: [
						{
							name: "Invalid API",
							url: "http://example.com/invalid",
						},
					],
				},
			});
			const router = new FileRouter(config);

			const baseSpec = {
				openapi: "3.1.0",
				info: { title: "Test API", version: "1.0.0" },
				paths: {},
			};
			const allTags = new Set<string>();

			// Should not throw and should not modify the spec
			await router["mergeExternalSpecs"](baseSpec, allTags);

			expect(baseSpec.paths).toEqual({});

			// Restore original fetch
			global.fetch = originalFetch;
		});

		test("should handle external spec with no tags", async () => {
			// Mock fetch for spec without tags
			const originalFetch = global.fetch;
			global.fetch = mock(async () => {
				return new Response(
					JSON.stringify({
						openapi: "3.1.0",
						info: { title: "Simple API", version: "1.0.0" },
						paths: {
							"/simple": {
								get: {
									summary: "Simple endpoint",
									responses: { 200: { description: "Success" } },
								},
							},
						},
						// No tags property
					}),
					{
						headers: { "content-type": "application/json" },
						status: 200,
					},
				);
			}) as unknown as typeof fetch;

			const config = validateConfig({
				server: {
					routes: {
						dir: "./dev/routes",
					},
				},
				swagger: {
					externalSpecs: [
						{
							name: "Simple API",
							url: "http://example.com/simple.json",
						},
					],
				},
			});
			const router = new FileRouter(config);

			const baseSpec = {
				openapi: "3.1.0",
				info: { title: "Test API", version: "1.0.0" },
				paths: {},
				tags: [],
			};
			const allTags = new Set<string>();

			await router["mergeExternalSpecs"](baseSpec, allTags);

			expect(baseSpec.paths).toHaveProperty("/simple");
			expect(baseSpec.tags).toEqual([]); // Should remain empty

			// Restore original fetch
			global.fetch = originalFetch;
		});
	});
});
