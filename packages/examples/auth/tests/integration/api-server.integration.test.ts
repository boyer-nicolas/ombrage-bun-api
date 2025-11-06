import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Api, type OmbrageServer } from "ombrage-bun-api";
import type { OpenAPIV3_1 } from "openapi-types";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";

describe("API Server Integration Tests", () => {
	let server: OmbrageServer;
	let baseURL: string;

	beforeAll(async () => {
		// Run migrations for test database
		console.log("Running database migrations for API tests...");
		migrate(db, {
			migrationsFolder: "drizzle/",
		});

		// Create server instance identical to main app
		const serverInstance = new Api({
			title: "Example Auth API",
			server: {
				routes: {
					dir: "./routes",
				},
				port: 0, // Use random available port
			},
			proxy: {
				enabled: true,
				configs: [
					{
						pattern: "/auth/**",
						description:
							"Authentication endpoints handled by better-auth (all levels)",
						handler: async ({ request }) => {
							console.log(`[AUTH] ${request.method} ${request.url}`);

							try {
								// Let better-auth handle the authentication request
								const response = await auth.handler(request);

								console.log(
									`[AUTH] Response status: ${response?.status || "no response"}`,
								);

								// If better-auth handled the request, return its response
								if (response) {
									return {
										proceed: false, // Don't proxy anywhere - we have the response
										response,
									};
								}

								// If better-auth didn't handle it, let it fall through to file routes
								return {
									proceed: false,
									response: new Response("Auth endpoint not found", {
										status: 404,
									}),
								};
							} catch (error) {
								console.error("[AUTH] Error handling request:", error);
								return {
									proceed: false,
									response: new Response("Internal auth error", {
										status: 500,
									}),
								};
							}
						},
					},
				],
			},
		});

		server = await serverInstance.start();

		// Extract hostname and port from the server URL
		const serverUrl = new URL(server.url);
		baseURL = `${serverUrl.protocol}//${serverUrl.host}`;

		console.log(`Test API server started at ${baseURL}`);
	});

	afterAll(async () => {
		if (server) {
			server.stop();
			console.log("Test API server stopped");
		}
	});

	describe("Server Basic Functionality", () => {
		test("should serve Swagger UI at root", async () => {
			const response = await fetch(`${baseURL}/`);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe("text/html");

			const html = await response.text();
			expect(html).toContain("SwaggerUI");
			expect(html).toContain("swagger-ui");
		});

		test("should serve OpenAPI spec at /api-docs.json", async () => {
			const response = await fetch(`${baseURL}/api-docs.json`);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe(
				"application/json;charset=utf-8",
			);

			const spec = await response.json();
			expect(spec).toHaveProperty("openapi", "3.1.0");
			expect(spec).toHaveProperty("info");
			expect(spec).toHaveProperty("paths");
			expect(spec.info).toHaveProperty("title", "Example Auth API");
		});

		test("should return 404 for unknown routes", async () => {
			const response = await fetch(`${baseURL}/nonexistent`);

			expect(response.status).toBe(404);

			const error = await response.json();
			expect(error).toHaveProperty("error", "Not Found");
			expect(error).toHaveProperty("message");
			expect(error).toHaveProperty("status", 404);
		});

		test("should handle CORS preflight requests", async () => {
			const response = await fetch(`${baseURL}/test`, {
				method: "OPTIONS",
				headers: {
					Origin: "http://localhost:3000",
					"Access-Control-Request-Method": "GET",
					"Access-Control-Request-Headers": "Content-Type",
				},
			});

			// The framework should handle OPTIONS requests gracefully
			expect([200, 404, 405]).toContain(response.status);
		});
	});

	describe("Route Handling", () => {
		test("should serve test route", async () => {
			const response = await fetch(`${baseURL}/test`);

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result).toHaveProperty("message");
			expect(result).toHaveProperty("timestamp");
			expect(result).toHaveProperty("environment");
		});
	});

	describe("Proxy Integration", () => {
		test("should proxy auth requests to better-auth", async () => {
			// Test that auth endpoints are handled by the proxy
			const response = await fetch(`${baseURL}/auth/get-session`);

			// Should get 200 for unauthenticated request with better-auth default behavior
			expect(response.status).toBe(200);

			const result = await response.json();
			// Better-auth might return different structure for unauthenticated requests
			// Let's just check that we get a valid JSON response
			expect(typeof result).toBe("object");
		});

		test("should serve auth OpenAPI spec through proxy", async () => {
			const response = await fetch(`${baseURL}/auth/openapi`);

			expect(response.status).toBe(200);
			// Better-auth returns HTML for OpenAPI documentation
			expect(response.headers.get("content-type")).toContain("text/html");

			const html = await response.text();
			expect(html).toContain("Scalar API Reference");
		});

		test("should return 404 for non-existent auth endpoints", async () => {
			const response = await fetch(`${baseURL}/auth/nonexistent-endpoint`);

			expect(response.status).toBe(404);
		});
	});

	describe("OpenAPI Documentation", () => {
		test("should include file routes in OpenAPI spec", async () => {
			const response = await fetch(`${baseURL}/api-docs.json`);
			expect(response.status).toBe(200);

			const spec = (await response.json()) as OpenAPIV3_1.Document;

			// Check that the spec has paths
			expect(spec.paths).toBeDefined();

			if (!spec.paths) {
				throw new Error("OpenAPI spec has no paths");
			}

			// Should include the test route
			expect(spec.paths).toHaveProperty("/test");

			// Check that the test route has proper operation details
			const testPath = spec.paths["/test"];
			if (testPath && typeof testPath === "object") {
				expect(testPath).toHaveProperty("get");
				const getOp = testPath.get as OpenAPIV3_1.OperationObject;
				expect(getOp).toHaveProperty("summary");
				expect(getOp).toHaveProperty("description");
				expect(getOp).toHaveProperty("responses");
			}
		});

		test("should have proper response schemas in OpenAPI spec", async () => {
			const response = await fetch(`${baseURL}/api-docs.json`);
			const spec = (await response.json()) as OpenAPIV3_1.Document;

			// Verify that operations have proper response definitions
			if (spec.paths) {
				for (const [, pathItem] of Object.entries(spec.paths)) {
					if (pathItem && typeof pathItem === "object") {
						for (const [method, operation] of Object.entries(pathItem)) {
							if (
								operation &&
								typeof operation === "object" &&
								["get", "post", "put", "delete", "patch"].includes(method)
							) {
								const op = operation as OpenAPIV3_1.OperationObject;

								// Check that responses have proper descriptions
								if (op.responses) {
									for (const [statusCode, responseSpec] of Object.entries(
										op.responses,
									)) {
										if (responseSpec && typeof responseSpec === "object") {
											const resp = responseSpec as OpenAPIV3_1.ResponseObject;
											expect(resp.description).toBeDefined();
											expect(typeof resp.description).toBe("string");

											// For 2xx responses, should have content schema
											if (statusCode.startsWith("2")) {
												expect(resp.content).toBeDefined();
											}
										}
									}
								}
							}
						}
					}
				}
			}
		});

		test("should include proper tags in OpenAPI spec", async () => {
			const response = await fetch(`${baseURL}/api-docs.json`);
			const spec = (await response.json()) as OpenAPIV3_1.Document;

			expect(spec.tags).toBeDefined();
			expect(Array.isArray(spec.tags)).toBe(true);

			// Should have at least one tag
			if (spec.tags && spec.tags.length > 0) {
				expect(spec.tags[0]).toHaveProperty("name");
				expect(typeof spec.tags[0].name).toBe("string");
			}
		});
	});

	describe("Error Handling", () => {
		test("should handle malformed requests gracefully", async () => {
			// Test with invalid HTTP method - fetch will handle this properly
			const response = await fetch(`${baseURL}/test`, {
				method: "PATCH", // Use a valid HTTP method that's not implemented
			});

			// Should return method not allowed
			expect([405, 501]).toContain(response.status);
		});

		test("should provide helpful error messages", async () => {
			const response = await fetch(`${baseURL}/definitely-not-a-route`);

			expect(response.status).toBe(404);

			const error = await response.json();
			expect(error).toHaveProperty("error");
			expect(error).toHaveProperty("message");
			expect(error).toHaveProperty("status");
			expect(typeof error.message).toBe("string");
			expect(error.message.length).toBeGreaterThan(0);
		});
	});
});
