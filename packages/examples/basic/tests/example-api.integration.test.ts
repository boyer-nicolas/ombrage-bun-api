import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";
import { Api, type OmbrageServer } from "ombrage-bun-api";

describe("Example API Integration Tests", () => {
	let server: OmbrageServer;
	let baseUrl: string;

	beforeAll(async () => {
		// Create server instance using the example routes
		const routesDir = path.join(__dirname, "..", "routes");
		const serverInstance = new Api({
			server: {
				routes: {
					dir: routesDir,
				},
				port: 0, // Use random available port
			},
		});

		server = await serverInstance.start();
		baseUrl = `http://${server.hostname}:${server.port}`;

		console.log(`Test server started at ${baseUrl}`);
	});

	afterAll(async () => {
		// Stop the server
		if (server) {
			server.stop();
		}
	});

	describe("Health Check Endpoint", () => {
		test("GET /healthz should return built-in health status", async () => {
			const response = await fetch(`${baseUrl}/healthz`);
			expect(response.status).toBe(200);

			// The built-in healthz endpoint returns plain text "OK"
			const text = await response.text();
			expect(text).toBe("OK");
		});

		test("POST /healthz should return OK (built-in endpoint)", async () => {
			const testMessage = "Hello, World!";
			const response = await fetch(`${baseUrl}/healthz`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ message: testMessage }),
			});

			// Built-in healthz endpoint returns 200 OK for any method
			expect(response.status).toBe(200);
			const res = await response.json();
			expect(res).toEqual({ echo: testMessage });
		});
	});

	describe("Custom Health Check Endpoint", () => {
		test("GET /health should return custom health status", async () => {
			const response = await fetch(`${baseUrl}/health`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("status", "healthy");
			expect(data).toHaveProperty("service", "example-api");
			expect(data).toHaveProperty("timestamp");
			// @ts-expect-error This is a test file
			expect(new Date(data.timestamp)).toBeInstanceOf(Date);
		});

		test("POST /health should echo message", async () => {
			const testMessage = "Hello, World!";
			const response = await fetch(`${baseUrl}/health`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ message: testMessage }),
			});

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("echo", testMessage);
			expect(data).toHaveProperty("receivedAt");
			// @ts-expect-error This is a test file
			expect(new Date(data.receivedAt)).toBeInstanceOf(Date);
		});

		test("POST /health should validate required message field", async () => {
			const response = await fetch(`${baseUrl}/health`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({}), // Missing message field
			});

			expect(response.status).toBe(500);

			// Verify error response structure
			const data = await response.json();
			expect(data).toHaveProperty("error", "Internal Server Error");
			expect(data).toHaveProperty("status", 500);
		});
	});

	describe("Users Endpoint", () => {
		test("GET /users should return all users", async () => {
			const response = await fetch(`${baseUrl}/users`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("users");
			expect(data).toHaveProperty("total");
			// @ts-expect-error This is a test file
			expect(Array.isArray(data.users)).toBe(true);
			// @ts-expect-error This is a test file
			expect(data.users.length).toBe(3); // Mock data has 3 users
			// @ts-expect-error This is a test file
			expect(data.total).toBe(3);

			// Verify user structure
			// @ts-expect-error This is a test file
			const user = data.users[0];
			expect(user).toHaveProperty("id");
			expect(user).toHaveProperty("name");
			expect(user).toHaveProperty("email");
		});

		test("GET /users with limit should return limited results", async () => {
			const response = await fetch(`${baseUrl}/users?limit=2`);
			expect(response.status).toBe(200);

			const data = await response.json();
			// @ts-expect-error This is a test file
			expect(data.users.length).toBe(2);
			// @ts-expect-error This is a test file
			expect(data.total).toBe(2);
		});

		test("GET /users with search should filter results", async () => {
			const response = await fetch(`${baseUrl}/users?search=john`);
			expect(response.status).toBe(200);

			const data = await response.json();
			// @ts-expect-error This is a test file
			expect(data.users.length).toBeGreaterThan(0);
			expect(
				// @ts-expect-error This is a test file
				data.users.some(
					(user: { name: string; email: string }) =>
						user.name.toLowerCase().includes("john") ||
						user.email.toLowerCase().includes("john"),
				),
			).toBe(true);
		});

		test("POST /users should create a new user", async () => {
			const newUser = {
				name: "Test User",
				email: "test@example.com",
			};

			const response = await fetch(`${baseUrl}/users`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(newUser),
			});

			expect(response.status).toBe(201);

			const data = await response.json();
			expect(data).toHaveProperty("id");
			expect(data).toHaveProperty("name", newUser.name);
			expect(data).toHaveProperty("email", newUser.email);
			expect(data).toHaveProperty("createdAt");
			// @ts-expect-error This is a test file
			expect(new Date(data.createdAt)).toBeInstanceOf(Date);
		});

		test("POST /users should validate email format", async () => {
			const invalidUser = {
				name: "Test User",
				email: "invalid-email",
			};

			const response = await fetch(`${baseUrl}/users`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invalidUser),
			});

			expect(response.status).toBe(500);

			// Verify error response structure
			const data = await response.json();
			expect(data).toHaveProperty("error", "Internal Server Error");
			expect(data).toHaveProperty("status", 500);
		});

		test("POST /users should require name field", async () => {
			const invalidUser = {
				email: "test@example.com",
			};

			const response = await fetch(`${baseUrl}/users`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invalidUser),
			});

			expect(response.status).toBe(500);

			// Verify error response structure
			const data = await response.json();
			expect(data).toHaveProperty("error", "Internal Server Error");
			expect(data).toHaveProperty("status", 500);
		});
	});

	describe("User by ID Endpoint", () => {
		test("GET /users/:id should return user by ID", async () => {
			const userId = "123";
			const response = await fetch(`${baseUrl}/users/${userId}`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("id", userId);
			expect(data).toHaveProperty("name", `User ${userId}`);
			expect(data).toHaveProperty("email", `user${userId}@example.com`);
			expect(data).toHaveProperty("createdAt");
			// @ts-expect-error This is a test file
			expect(new Date(data.createdAt)).toBeInstanceOf(Date);
		});

		test("PUT /users/:id should update user", async () => {
			const userId = "123";
			const updateData = {
				name: "Updated User",
				email: "updated@example.com",
			};

			const response = await fetch(`${baseUrl}/users/${userId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updateData),
			});

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("id", userId);
			expect(data).toHaveProperty("name", updateData.name);
			expect(data).toHaveProperty("email", updateData.email);
			expect(data).toHaveProperty("updatedAt");
			// @ts-expect-error This is a test file
			expect(new Date(data.updatedAt)).toBeInstanceOf(Date);
		});

		test("PUT /users/:id should allow partial updates", async () => {
			const userId = "123";
			const updateData = {
				name: "Partially Updated User",
			};

			const response = await fetch(`${baseUrl}/users/${userId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updateData),
			});

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("id", userId);
			expect(data).toHaveProperty("name", updateData.name);
			expect(data).toHaveProperty("email"); // Should still have an email
			expect(data).toHaveProperty("updatedAt");
		});

		test("PUT /users/:id should require at least one field", async () => {
			const userId = "123";
			const response = await fetch(`${baseUrl}/users/${userId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({}), // Empty body
			});

			expect(response.status).toBe(500);

			// Verify error response structure
			const data = await response.json();
			expect(data).toHaveProperty("error", "Internal Server Error");
			expect(data).toHaveProperty("status", 500);
		});

		test("PUT /users/:id should validate email format", async () => {
			const userId = "123";
			const updateData = {
				email: "invalid-email-format",
			};

			const response = await fetch(`${baseUrl}/users/${userId}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(updateData),
			});

			expect(response.status).toBe(500);

			// Verify error response structure
			const data = await response.json();
			expect(data).toHaveProperty("error", "Internal Server Error");
			expect(data).toHaveProperty("status", 500);
		});
	});

	describe("OpenAPI Documentation", () => {
		test("GET / should return OpenAPI documentation", async () => {
			const response = await fetch(`${baseUrl}/`);
			expect(response.status).toBe(200);

			const html = await response.text();
			expect(html).toContain("swagger");
			expect(html).toContain("SwaggerUI");
		});
	});

	describe("Error Handling", () => {
		test("should handle 404 for non-existent routes", async () => {
			const response = await fetch(`${baseUrl}/non-existent-route`);
			expect(response.status).toBe(404);
		});

		test("should handle malformed JSON in request body", async () => {
			const response = await fetch(`${baseUrl}/health`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: "{ invalid json",
			});

			// Should handle malformed JSON gracefully
			expect(response.status).toBeGreaterThanOrEqual(400);
		});

		test("should handle missing Content-Type header for POST requests", async () => {
			const response = await fetch(`${baseUrl}/health`, {
				method: "POST",
				body: JSON.stringify({ message: "test" }),
			});

			// Framework returns 500 for missing Content-Type with JSON body
			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data).toHaveProperty("error", "Internal Server Error");
		});
	});

	describe("Performance", () => {
		test("should respond quickly to health checks", async () => {
			const startTime = Date.now();
			const response = await fetch(`${baseUrl}/healthz`);
			const endTime = Date.now();

			expect(response.status).toBe(200);
			expect(endTime - startTime).toBeLessThan(100); // Should respond in under 100ms
		});
	});
});
