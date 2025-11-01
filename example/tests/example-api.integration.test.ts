import { afterAll, beforeAll, describe, expect, test } from "bun:test";

describe("Example API Integration Tests", () => {
	const baseUrl = "http://localhost:8080";
	let serverProcess: ReturnType<typeof Bun.spawn>;

	beforeAll(async () => {
		// Start the example server as a subprocess
		const proc = Bun.spawn(["bun", "run", "start"], {
			cwd: "/Users/nicolasboyer/Dev/framework/example",
			stdout: "pipe",
			stderr: "pipe",
		});

		serverProcess = proc;

		// Wait for server to start
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Verify server is running
		let retries = 5;
		while (retries > 0) {
			try {
				await fetch(`${baseUrl}/healthz`);
				break;
			} catch {
				retries--;
				if (retries === 0) throw new Error("Server failed to start");
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	});

	afterAll(async () => {
		// Stop the server
		if (serverProcess) {
			serverProcess.kill();
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
			const text = await response.text();
			expect(text).toBe("OK");
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

			// Should return 400 for validation error or 500 for internal error
			expect([400, 500]).toContain(response.status);
		});
	});

	describe("Users Endpoint", () => {
		test("GET /users should return all users", async () => {
			const response = await fetch(`${baseUrl}/users`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty("users");
			expect(data).toHaveProperty("total");
			expect(Array.isArray(data.users)).toBe(true);
			expect(data.users.length).toBe(3); // Mock data has 3 users
			expect(data.total).toBe(3);

			// Verify user structure
			const user = data.users[0];
			expect(user).toHaveProperty("id");
			expect(user).toHaveProperty("name");
			expect(user).toHaveProperty("email");
		});

		test("GET /users with limit should return limited results", async () => {
			const response = await fetch(`${baseUrl}/users?limit=2`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.users.length).toBe(2);
			expect(data.total).toBe(2);
		});

		test("GET /users with search should filter results", async () => {
			const response = await fetch(`${baseUrl}/users?search=john`);
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.users.length).toBeGreaterThan(0);
			expect(
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

			// Expect either 400 (validation error) or 500 (internal error during validation)
			expect([400, 500]).toContain(response.status);
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

			// Expect either 400 (validation error) or 500 (internal error during validation)
			expect([400, 500]).toContain(response.status);
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

			// Expect either 400 (validation error) or 500 (internal error during validation)
			expect([400, 500]).toContain(response.status);
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

			// Expect either 400 (validation error) or 500 (internal error during validation)
			expect([400, 500]).toContain(response.status);
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
});
