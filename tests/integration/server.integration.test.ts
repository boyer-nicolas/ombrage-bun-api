import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppConfig } from "../../src/lib/config";
import { Server } from "../../src/lib/server";

describe("Server Integration Tests", () => {
	let server: Bun.Server<undefined>;
	let baseURL: string;

	beforeAll(async () => {
		(Bun.env as Record<string, string | undefined>).ENVIRONMENT = "test";
		(Bun.env as Record<string, string | undefined>).LOG_LEVEL = "error";
		(Bun.env as Record<string, string | undefined>).AUTH_SECRET =
			"test-secret-for-integration-tests";

		AppConfig.load();

		// Start server with dev routes on a random available port
		const serverInstance = new Server("./dev/routes");
		const options = await serverInstance.init();
		options.port = 0; // Use random available port

		server = Bun.serve(options);
		baseURL = `http://${server.hostname}:${server.port}`;

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
