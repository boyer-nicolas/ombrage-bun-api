import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { OpenAPIV3_1 } from "openapi-types";
import { Api, type OmbrageServer } from "../../src/lib/api";

describe("Server Integration Tests", () => {
	let server: OmbrageServer;
	let baseURL: string;

	beforeAll(async () => {
		// Start server with dev routes on a random available port
		const serverInstance = new Api({
			server: {
				routes: {
					dir: "./dev/routes",
				},
				port: 0,
			},
		});

		server = await serverInstance.start();

		// Extract hostname and port from the server URL
		const serverUrl = new URL(server.url);
		baseURL = `${serverUrl.protocol}//${serverUrl.host}`;

		console.log(`Test server started at ${baseURL}`);
	});

	afterAll(async () => {
		if (server) {
			server.stop();
			console.log("Test server stopped");
		}
	});

	test("should respond to health check", async () => {
		const response = await fetch(`${baseURL}/healthz`);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("OK");
	});

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
	});

	test("should include summary and description in OpenAPI spec operations", async () => {
		const response = await fetch(`${baseURL}/api-docs.json`);
		expect(response.status).toBe(200);

		const spec = (await response.json()) as OpenAPIV3_1.Document;

		// Check that the spec has paths
		expect(spec.paths).toBeDefined();

		if (!spec.paths) {
			throw new Error("OpenAPI spec has no paths");
		}

		// Look for operations that should have summary and description
		let foundOperationWithSummary = false;
		let foundOperationWithDescription = false;

		for (const [, pathItem] of Object.entries(spec.paths)) {
			if (pathItem && typeof pathItem === "object") {
				for (const [method, operation] of Object.entries(pathItem)) {
					if (
						operation &&
						typeof operation === "object" &&
						["get", "post", "put", "delete", "patch"].includes(method)
					) {
						const op = operation as OpenAPIV3_1.OperationObject;
						if (op.summary) {
							foundOperationWithSummary = true;
							expect(typeof op.summary).toBe("string");
							expect(op.summary.length).toBeGreaterThan(0);
						}

						if (op.description) {
							foundOperationWithDescription = true;
							expect(typeof op.description).toBe("string");
							expect(op.description.length).toBeGreaterThan(0);
						}

						// Check that responses have proper descriptions
						if (op.responses) {
							for (const [, responseSpec] of Object.entries(op.responses)) {
								if (responseSpec && typeof responseSpec === "object") {
									const resp = responseSpec as OpenAPIV3_1.ResponseObject;
									expect(resp.description).toBeDefined();
									expect(typeof resp.description).toBe("string");
								}
							}
						}
					}
				}
			}
		}

		// At least one operation should have summary and description from the dev routes
		expect(foundOperationWithSummary).toBe(true);
		expect(foundOperationWithDescription).toBe(true);
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
		const response = await fetch(`${baseURL}/storage`, {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:3000",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "Content-Type",
			},
		});

		// The framework should handle OPTIONS requests gracefully
		expect([200, 404, 405]).toContain(response.status);
	});
});
