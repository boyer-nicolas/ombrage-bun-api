import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Api, type ProxyHandler } from "../../src";

describe("Proxy Integration Tests", () => {
	// biome-ignore lint/suspicious/noExplicitAny: This is a test file
	let mockTargetServer: any;
	let mockTargetPort: number;
	// biome-ignore lint/suspicious/noExplicitAny: This is a test file
	let apiServer: any;
	let apiPort: number;

	beforeAll(async () => {
		// Create a mock target server to proxy to
		mockTargetServer = Bun.serve({
			port: 0, // Use random available port
			fetch(request) {
				const url = new URL(request.url);

				// Simple echo server that returns request details
				return Response.json({
					method: request.method,
					path: url.pathname,
					search: url.search,
					headers: Object.fromEntries(request.headers.entries()),
					timestamp: new Date().toISOString(),
				});
			},
		});
		mockTargetPort = mockTargetServer.port;

		// Create API server with proxy configuration
		const authHandler: ProxyHandler = async ({ request }) => {
			const authHeader = request.headers.get("authorization");

			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return {
					proceed: false,
					response: new Response(
						JSON.stringify({
							error: "Unauthorized",
							message: "Missing authorization header",
						}),
						{
							status: 401,
							headers: { "Content-Type": "application/json" },
						},
					),
				};
			}

			const token = authHeader.substring(7);
			if (token !== "valid-token") {
				return {
					proceed: false,
					response: new Response(
						JSON.stringify({ error: "Forbidden", message: "Invalid token" }),
						{
							status: 403,
							headers: { "Content-Type": "application/json" },
						},
					),
				};
			}

			return {
				proceed: true,
				headers: {
					"X-User-ID": "test-user",
				},
			};
		};

		const api = new Api({
			environment: "test",
			server: {
				port: 0, // Use random available port
				routes: { dir: "./tests/fixtures/routes" },
			},
			proxy: {
				enabled: true,
				configs: [
					// Protected routes with auth handler
					{
						pattern: "/api/protected/*",
						target: `http://localhost:${mockTargetPort}`,
						description: "Protected API endpoints",
						handler: authHandler,
						timeout: 5000,
					},
					// Public routes without handler
					{
						pattern: "/api/public/*",
						target: `http://localhost:${mockTargetPort}`,
						description: "Public API endpoints",
						timeout: 5000,
					},
					// User routes with parameter extraction
					{
						pattern: "/users/*/profile",
						target: `http://localhost:${mockTargetPort}`,
						description: "User profile endpoints",
						handler: async ({ params }) => {
							const userId = params.param0;
							return {
								proceed: true,
								headers: {
									"X-User-ID": userId || "unknown",
								},
							};
						},
						timeout: 5000,
					},
				],
			},
		});

		apiServer = await api.start();
		apiPort = apiServer.port;
	});

	afterAll(() => {
		if (mockTargetServer) {
			mockTargetServer.stop();
		}
		if (apiServer) {
			apiServer.stop();
		}
	});

	test("should proxy public requests without authentication", async () => {
		const response = await fetch(`http://localhost:${apiPort}/api/public/test`);
		expect(response.status).toBe(200);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.method).toBe("GET");
		expect(data.path).toBe("/api/public/test");
	});

	test("should block protected requests without authorization", async () => {
		const response = await fetch(
			`http://localhost:${apiPort}/api/protected/test`,
		);
		expect(response.status).toBe(401);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.error).toBe("Unauthorized");
		expect(data.message).toBe("Missing authorization header");
	});

	test("should block protected requests with invalid token", async () => {
		const response = await fetch(
			`http://localhost:${apiPort}/api/protected/test`,
			{
				headers: {
					Authorization: "Bearer invalid-token",
				},
			},
		);
		expect(response.status).toBe(403);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.error).toBe("Forbidden");
		expect(data.message).toBe("Invalid token");
	});

	test("should allow protected requests with valid token", async () => {
		const response = await fetch(
			`http://localhost:${apiPort}/api/protected/test`,
			{
				headers: {
					Authorization: "Bearer valid-token",
				},
			},
		);
		expect(response.status).toBe(200);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.method).toBe("GET");
		expect(data.path).toBe("/api/protected/test");
		expect(data.headers["x-user-id"]).toBe("test-user");
	});

	test("should extract parameters from wildcard patterns", async () => {
		const response = await fetch(
			`http://localhost:${apiPort}/users/123/profile`,
		);
		expect(response.status).toBe(200);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.method).toBe("GET");
		expect(data.path).toBe("/users/123/profile");
		expect(data.headers["x-user-id"]).toBe("123");
	});

	test("should preserve query parameters in proxy requests", async () => {
		const response = await fetch(
			`http://localhost:${apiPort}/api/public/search?q=test&limit=10`,
		);
		expect(response.status).toBe(200);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.method).toBe("GET");
		expect(data.path).toBe("/api/public/search");
		expect(data.search).toBe("?q=test&limit=10");
	});

	test("should handle POST requests with body", async () => {
		const requestBody = { name: "test", value: 123 };
		const response = await fetch(
			`http://localhost:${apiPort}/api/public/create`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			},
		);
		expect(response.status).toBe(200);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.method).toBe("POST");
		expect(data.path).toBe("/api/public/create");
		expect(data.headers["content-type"]).toBe("application/json");
	});

	test("should return 404 for non-matching proxy patterns", async () => {
		const response = await fetch(
			`http://localhost:${apiPort}/non-matching/path`,
		);
		expect(response.status).toBe(404);

		// biome-ignore lint/suspicious/noExplicitAny: This is a test file
		const data = (await response.json()) as any;
		expect(data.error).toBe("Not Found");
	});

	test("should handle proxy request timeout", async () => {
		// Create a slow target server
		const slowServer = Bun.serve({
			port: 0,
			async fetch() {
				// Delay longer than proxy timeout
				await new Promise((resolve) => setTimeout(resolve, 10000));
				return Response.json({ slow: true });
			},
		});

		try {
			const api = new Api({
				environment: "test",
				server: {
					port: 0,
					routes: { dir: "./tests/fixtures/routes" },
				},
				proxy: {
					enabled: true,
					configs: [
						{
							pattern: "/slow/*",
							target: `http://localhost:${slowServer.port}`,
							timeout: 1000, // 1 second timeout
						},
					],
				},
			});

			const testServer = await api.start();

			try {
				const response = await fetch(
					`http://localhost:${testServer.port}/slow/test`,
				);
				expect(response.status).toBe(502); // Bad Gateway
			} finally {
				testServer.stop();
			}
		} finally {
			slowServer.stop();
		}
	}, 15000); // Increase test timeout

	test("should handle proxy target that doesn't exist", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			proxy: {
				enabled: true,
				configs: [
					{
						pattern: "/nonexistent/*",
						target: "http://127.0.0.1:12345", // Use a valid but unlikely-to-be-used port
						timeout: 2000,
						retries: 0,
					},
				],
			},
		});

		const testServer = await api.start();

		try {
			const response = await fetch(
				`http://localhost:${testServer.port}/nonexistent/test`,
			);
			expect(response.status).toBe(502); // Bad Gateway
		} finally {
			testServer.stop();
		}
	});

	test("should handle auth-only proxy without target", async () => {
		// Auth handler that doesn't need to proxy to another service
		const authOnlyHandler: ProxyHandler = async ({ request }) => {
			const authHeader = request.headers.get("authorization");

			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return {
					proceed: false,
					response: new Response(
						JSON.stringify({
							error: "Unauthorized",
							message: "Missing authorization header",
						}),
						{
							status: 401,
							headers: { "Content-Type": "application/json" },
						},
					),
				};
			}

			const token = authHeader.substring(7);
			if (token !== "valid-auth-token") {
				return {
					proceed: false,
					response: new Response(
						JSON.stringify({ error: "Forbidden", message: "Invalid token" }),
						{
							status: 403,
							headers: { "Content-Type": "application/json" },
						},
					),
				};
			}

			// Handle auth validation locally, return success response
			return {
				proceed: false, // Don't proxy anywhere
				response: new Response(
					JSON.stringify({
						success: true,
						message: "Authentication successful",
						user: { id: "test-user", role: "admin" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			};
		};

		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			proxy: {
				enabled: true,
				configs: [
					{
						pattern: "/auth/*",
						// No target specified - handled entirely by the handler
						description: "Authentication-only endpoints",
						handler: authOnlyHandler,
					},
				],
			},
		});

		const testServer = await api.start();

		try {
			// Test missing auth header
			const response1 = await fetch(
				`http://localhost:${testServer.port}/auth/validate`,
			);
			expect(response1.status).toBe(401);
			// biome-ignore lint/suspicious/noExplicitAny: This is a test file
			const data1 = (await response1.json()) as any;
			expect(data1.error).toBe("Unauthorized");

			// Test invalid token
			const response2 = await fetch(
				`http://localhost:${testServer.port}/auth/validate`,
				{
					headers: {
						Authorization: "Bearer invalid-token",
					},
				},
			);
			expect(response2.status).toBe(403);
			// biome-ignore lint/suspicious/noExplicitAny: This is a test file
			const data2 = (await response2.json()) as any;
			expect(data2.error).toBe("Forbidden");

			// Test valid token
			const response3 = await fetch(
				`http://localhost:${testServer.port}/auth/validate`,
				{
					headers: {
						Authorization: "Bearer valid-auth-token",
					},
				},
			);
			expect(response3.status).toBe(200);
			// biome-ignore lint/suspicious/noExplicitAny: This is a test file
			const data3 = (await response3.json()) as any;
			expect(data3.success).toBe(true);
			expect(data3.user.id).toBe("test-user");
		} finally {
			testServer.stop();
		}
	});

	test("should handle proxy with logging disabled", async () => {
		// Create a simple target server
		const targetServer = Bun.serve({
			port: 0,
			fetch() {
				return Response.json({ message: "success", timestamp: Date.now() });
			},
		});

		try {
			// Create API server with proxy configuration where logging is disabled
			const testServer = new Api({
				environment: "test",
				server: {
					port: 0,
					routes: { dir: "./tests/fixtures/routes" },
				},
				proxy: {
					enabled: true,
					configs: [
						{
							pattern: "/quiet/*",
							target: `http://localhost:${targetServer.port}`,
							enabled: true,
							logging: false, // Disable logging for this proxy
						},
					],
				},
			});

			const server = await testServer.start();

			try {
				// Make a request through the proxy
				const response = await fetch(
					`http://localhost:${server.port}/quiet/test`,
				);
				expect(response.status).toBe(200);

				// biome-ignore lint/suspicious/noExplicitAny: This is a test file
				const data = (await response.json()) as any;
				expect(data.message).toBe("success");

				// Since logging is disabled, we can't easily verify logs are not written
				// but we can verify the request succeeds without errors
			} finally {
				server.stop();
			}
		} finally {
			targetServer.stop();
		}
	});

	test("should skip proxy and pass through to original route when handler returns skip", async () => {
		// Create API server with a proxy that always skips
		const testServer = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			proxy: {
				enabled: true,
				configs: [
					{
						pattern: "/test",
						target: "http://example.com", // This should never be called
						handler: async () => {
							// Always skip to local route
							return {
								proceed: false,
								skip: true,
							};
						},
					},
				],
			},
		});

		const server = await testServer.start();

		try {
			// Make a request that should skip proxy and use local route
			const response = await fetch(`http://localhost:${server.port}/test`);
			expect(response.status).toBe(200);

			// biome-ignore lint/suspicious/noExplicitAny: This is a test file
			const data = (await response.json()) as any;
			expect(data.message).toBe("Test fixture route");
		} finally {
			server.stop();
		}
	});

	test("should skip proxy conditionally based on handler logic", async () => {
		// Create API server with conditional skip logic
		const testServer = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			proxy: {
				enabled: true,
				configs: [
					{
						pattern: "/test",
						target: "http://example.com",
						handler: async ({ request }) => {
							// Skip if header is present, otherwise block
							const skipHeader = request.headers.get("x-skip-proxy");
							if (skipHeader === "true") {
								return {
									proceed: false,
									skip: true,
								};
							}

							// Block without skip
							return {
								proceed: false,
								response: new Response("Proxy blocked", { status: 403 }),
							};
						},
					},
				],
			},
		});

		const server = await testServer.start();

		try {
			// Without header - should be blocked by handler
			const response1 = await fetch(`http://localhost:${server.port}/test`);
			expect(response1.status).toBe(403);
			const text1 = await response1.text();
			expect(text1).toBe("Proxy blocked");

			// With header - should skip to local route
			const response2 = await fetch(`http://localhost:${server.port}/test`, {
				headers: {
					"x-skip-proxy": "true",
				},
			});
			expect(response2.status).toBe(200);

			// biome-ignore lint/suspicious/noExplicitAny: This is a test file
			const data2 = (await response2.json()) as any;
			expect(data2.message).toBe("Test fixture route");
		} finally {
			server.stop();
		}
	});
});
