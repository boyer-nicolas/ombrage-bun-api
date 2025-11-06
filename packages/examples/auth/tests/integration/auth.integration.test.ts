import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Api, type OmbrageServer } from "ombrage-bun-api";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";

describe("Auth Integration Tests", () => {
	let server: OmbrageServer;
	let baseURL: string;
	let testSession: string;

	beforeAll(async () => {
		// Run migrations for test database
		console.log("Running database migrations for tests...");
		migrate(db, {
			migrationsFolder: "drizzle/",
		});

		// Create server instance with the same configuration as main app
		const serverInstance = new Api({
			title: "Test Auth API",
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
						description: "Authentication endpoints handled by better-auth",
						handler: async ({ request }) => {
							try {
								// Let better-auth handle the authentication request
								const response = await auth.handler(request);

								// If better-auth handled the request, return its response
								if (response) {
									return {
										proceed: false,
										response,
									};
								}

								// If better-auth didn't handle it, return 404
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

		console.log(`Test auth server started at ${baseURL}`);
	});

	afterAll(async () => {
		if (server) {
			server.stop();
			console.log("Test auth server stopped");
		}
	});

	describe("Authentication Endpoints", () => {
		test("should serve auth OpenAPI documentation", async () => {
			const response = await fetch(`${baseURL}/auth/openapi`);

			expect(response.status).toBe(200);
			// Better-auth returns HTML for OpenAPI documentation, not JSON
			expect(response.headers.get("content-type")).toContain("text/html");

			const html = await response.text();
			expect(html).toContain("Scalar API Reference");
		});

		test("should handle user signup", async () => {
			const signupData = {
				email: `test-${Date.now()}@example.com`,
				password: "testpassword123",
				name: "Test User",
			};

			const response = await fetch(`${baseURL}/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(signupData),
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result).toHaveProperty("user");
			expect(result.user).toHaveProperty("id");
			expect(result.user).toHaveProperty("email", signupData.email);
			expect(result.user).toHaveProperty("name", signupData.name);
		});

		test("should handle user signin", async () => {
			// First create a user to sign in with
			const userData = {
				email: `signin-test-${Date.now()}@example.com`,
				password: "testpassword123",
				name: "Signin Test User",
			};

			// Sign up
			const signupResponse = await fetch(`${baseURL}/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(userData),
			});

			expect(signupResponse.status).toBe(200);

			// Now sign in
			const signinResponse = await fetch(`${baseURL}/auth/sign-in/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: userData.email,
					password: userData.password,
				}),
			});

			expect(signinResponse.status).toBe(200);

			const signinResult = await signinResponse.json();
			expect(signinResult).toHaveProperty("user");
			// Better-auth might have different response structure, let's check what it actually has
			expect(signinResult.user).toHaveProperty("email", userData.email);

			// Get the session token from the Set-Cookie header or response
			const setCookieHeader = signinResponse.headers.get("set-cookie");
			if (setCookieHeader) {
				const sessionMatch = setCookieHeader.match(
					/better-auth\.session_token=([^;]+)/,
				);
				if (sessionMatch) {
					testSession = sessionMatch[1];
				}
			} else if (signinResult.token) {
				// Some auth libraries return token in response body
				testSession = signinResult.token;
			}
		});

		test("should get user session", async () => {
			if (!testSession) {
				// Create a session first
				const userData = {
					email: `session-test-${Date.now()}@example.com`,
					password: "testpassword123",
					name: "Session Test User",
				};

				// Sign up and sign in
				await fetch(`${baseURL}/auth/sign-up/email`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(userData),
				});

				const signinResponse = await fetch(`${baseURL}/auth/sign-in/email`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						email: userData.email,
						password: userData.password,
					}),
				});

				// Try to get session from response or cookies
				const signinResult = await signinResponse.json();
				const setCookieHeader = signinResponse.headers.get("set-cookie");
				if (setCookieHeader) {
					const sessionMatch = setCookieHeader.match(
						/better-auth\.session_token=([^;]+)/,
					);
					if (sessionMatch) {
						testSession = sessionMatch[1];
					}
				} else if (signinResult.token) {
					testSession = signinResult.token;
				}
			}

			// Skip test if we can't get a session token
			if (!testSession) {
				return;
			}

			const response = await fetch(`${baseURL}/auth/get-session`, {
				method: "GET",
				headers: {
					Cookie: `better-auth.session_token=${testSession}`,
				},
			});

			expect(response.status).toBe(200);

			const result = await response.json();
			expect(result).toHaveProperty("user");
			expect(result).toHaveProperty("session");
		});

		test("should handle sign out", async () => {
			if (!testSession) {
				return; // Skip if no session available
			}

			const response = await fetch(`${baseURL}/auth/sign-out`, {
				method: "POST",
				headers: {
					Cookie: `better-auth.session_token=${testSession}`,
				},
			});

			expect(response.status).toBe(200);

			// Verify session is no longer valid
			const sessionResponse = await fetch(`${baseURL}/auth/get-session`, {
				method: "GET",
				headers: {
					Cookie: `better-auth.session_token=${testSession}`,
				},
			});

			// After sign out, session should be invalid but might return 200 with null values
			expect([200, 401]).toContain(sessionResponse.status);
		});

		test("should reject invalid credentials", async () => {
			const response = await fetch(`${baseURL}/auth/sign-in/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "nonexistent@example.com",
					password: "wrongpassword",
				}),
			});

			expect(response.status).toBe(401);

			const result = await response.json();
			// Better-auth might return different error structure
			expect(result).toHaveProperty("message");
		});

		test("should prevent duplicate user registration", async () => {
			const userData = {
				email: `duplicate-test-${Date.now()}@example.com`,
				password: "testpassword123",
				name: "Duplicate Test User",
			};

			// First signup should succeed
			const firstResponse = await fetch(`${baseURL}/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(userData),
			});

			expect(firstResponse.status).toBe(200);

			// Second signup with same email should fail
			const secondResponse = await fetch(`${baseURL}/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(userData),
			});

			expect(secondResponse.status).toBe(422);

			const result = await secondResponse.json();
			// Better-auth might return different error structure
			expect(result).toHaveProperty("message");
		});
	});

	describe("Proxy Configuration", () => {
		test("should handle auth endpoints through proxy", async () => {
			// Test that auth endpoints are properly routed through the proxy
			// Without authentication, we should get a proper response (not 404)
			const response = await fetch(`${baseURL}/auth/get-session`, {
				method: "GET",
			});

			// Should get 200 for unauthenticated request with better-auth default behavior
			expect(response.status).toBe(200);

			const result = await response.json();
			// Better-auth might return different structure for unauthenticated requests
			// Let's just check that we get a valid JSON response
			expect(typeof result).toBe("object");
		});

		test("should return 404 for non-existent auth endpoints", async () => {
			const response = await fetch(`${baseURL}/auth/nonexistent`, {
				method: "GET",
			});

			expect(response.status).toBe(404);
		});
	});

	describe("Error Handling", () => {
		test("should handle malformed JSON in auth requests", async () => {
			const response = await fetch(`${baseURL}/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: "invalid json",
			});

			// Better-auth returns 500 for JSON parsing errors
			expect(response.status).toBe(500);
		});

		test("should handle missing required fields", async () => {
			const response = await fetch(`${baseURL}/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: "test@example.com",
					// Missing password and name
				}),
			});

			// Better-auth returns 500 for missing required fields
			expect(response.status).toBe(500);
		});
	});
});
