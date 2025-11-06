import { Api, type ProxyHandler } from "../src";

// Example authentication handler for protected routes
const authHandler: ProxyHandler = async ({ request }) => {
	const authHeader = request.headers.get("authorization");

	// Simple JWT token validation example
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return {
			proceed: false,
			response: new Response(
				JSON.stringify({
					error: "Unauthorized",
					message: "Missing or invalid authorization header",
				}),
				{
					status: 401,
					headers: { "Content-Type": "application/json" },
				},
			),
		};
	}

	const token = authHeader.substring(7);

	// Mock token validation - in real app, verify JWT signature
	if (token !== "valid-token-123") {
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

	// Add user info to headers for downstream service
	return {
		proceed: true,
		headers: {
			"X-User-ID": "user123",
			"X-User-Role": "admin",
		},
	};
};

// Example logging handler for API monitoring
const loggingHandler: ProxyHandler = async ({ request, params, target }) => {
	console.log(`[PROXY] ${request.method} ${request.url} -> ${target}`, {
		params,
		userAgent: request.headers.get("user-agent"),
		timestamp: new Date().toISOString(),
	});

	return { proceed: true };
};

// Example configuration with various proxy patterns
export const exampleProxyConfig = new Api({
	environment: "development",
	server: {
		port: 3000,
		logLevel: "debug",
		routes: { dir: "./dev/routes" },
	},
	proxy: {
		enabled: true,
		configs: [
			// Protected API routes with authentication
			{
				pattern: "/api/protected/*",
				enabled: true,
				target: "https://api.example.com",
				description: "Protected API endpoints requiring authentication",
				handler: authHandler,
				timeout: 15000,
				retries: 2,
				headers: {
					"X-Proxy-Source": "ombrage-api-gateway",
				},
			},

			// Public API routes with logging
			{
				pattern: "/api/public/*",
				enabled: true,
				target: "https://public-api.example.com",
				description: "Public API endpoints with request logging",
				handler: loggingHandler,
				timeout: 10000,
				retries: 1,
			},

			// User-specific routes with parameter extraction
			{
				pattern: "/users/*/profile",
				target: "https://user-service.example.com",
				description: "User profile service",
				handler: async ({ params }) => {
					// params.param0 contains the user ID from the wildcard
					const userId = params.param0;

					// Validate user ID format
					if (!userId || !/^\d+$/.test(userId)) {
						return {
							proceed: false,
							response: new Response(
								JSON.stringify({ error: "Invalid user ID format" }),
								{
									status: 400,
									headers: { "Content-Type": "application/json" },
								},
							),
						};
					}

					return {
						proceed: true,
						headers: {
							"X-User-ID": userId,
						},
					};
				},
			},

			// Multiple wildcards for complex routing
			{
				pattern: "/tenants/*/services/*/data",
				target: "https://multi-tenant-service.example.com",
				description: "Multi-tenant service routing",
				handler: async ({ params, target }) => {
					const tenantId = params.param0;
					const serviceId = params.param1;

					// Route to different targets based on tenant
					let finalTarget = target;
					if (tenantId === "premium") {
						finalTarget = "https://premium-service.example.com";
					}

					return {
						proceed: true,
						target: finalTarget,
						headers: {
							"X-Tenant-ID": tenantId || "",
							"X-Service-ID": serviceId || "",
						},
					};
				},
			},

			// Simple proxy without handler
			{
				pattern: "/legacy/*",
				target: "https://legacy-api.example.com",
				description: "Legacy API passthrough",
				timeout: 30000,
				retries: 3,
			},

			// Auth-only endpoint (no proxying to external service)
			{
				pattern: "/auth/*",
				// No target specified - handled entirely by the handler
				description: "Authentication endpoints handled locally",
				handler: async ({ request }) => {
					const url = new URL(request.url);
					const authHeader = request.headers.get("authorization");

					// Handle different auth endpoints
					if (url.pathname === "/auth/login") {
						if (request.method !== "POST") {
							return {
								proceed: false,
								response: new Response(
									JSON.stringify({ error: "Method not allowed" }),
									{
										status: 405,
										headers: { "Content-Type": "application/json" },
									},
								),
							};
						}

						// In a real implementation, validate credentials here
						const body = (await request.json()) as {
							username?: string;
							password?: string;
						};
						if (body.username === "admin" && body.password === "secret") {
							return {
								proceed: false,
								response: new Response(
									JSON.stringify({
										success: true,
										token: "fake-jwt-token-123",
										user: { id: 1, username: "admin", role: "admin" },
									}),
									{
										status: 200,
										headers: { "Content-Type": "application/json" },
									},
								),
							};
						} else {
							return {
								proceed: false,
								response: new Response(
									JSON.stringify({ error: "Invalid credentials" }),
									{
										status: 401,
										headers: { "Content-Type": "application/json" },
									},
								),
							};
						}
					}

					if (url.pathname === "/auth/validate") {
						if (!authHeader || !authHeader.startsWith("Bearer ")) {
							return {
								proceed: false,
								response: new Response(
									JSON.stringify({ error: "Missing authorization header" }),
									{
										status: 401,
										headers: { "Content-Type": "application/json" },
									},
								),
							};
						}

						const token = authHeader.substring(7);
						if (token === "fake-jwt-token-123") {
							return {
								proceed: false,
								response: new Response(
									JSON.stringify({
										valid: true,
										user: { id: 1, username: "admin", role: "admin" },
									}),
									{
										status: 200,
										headers: { "Content-Type": "application/json" },
									},
								),
							};
						} else {
							return {
								proceed: false,
								response: new Response(
									JSON.stringify({ error: "Invalid token" }),
									{
										status: 403,
										headers: { "Content-Type": "application/json" },
									},
								),
							};
						}
					}

					// Default response for unhandled auth endpoints
					return {
						proceed: false,
						response: new Response(
							JSON.stringify({ error: "Auth endpoint not found" }),
							{
								status: 404,
								headers: { "Content-Type": "application/json" },
							},
						),
					};
				},
			},
		],
	},
	title: "Proxy Example API",
	description:
		"API demonstrating proxy capabilities with wildcards and handlers",
});

// Example of how to start the server
if (import.meta.main) {
	console.log("Starting proxy example server...");
	console.log("Try these endpoints:");
	console.log(
		"- GET /api/protected/users (requires 'Authorization: Bearer valid-token-123')",
	);
	console.log("- GET /api/public/status (logs request and proxies)");
	console.log("- GET /users/123/profile (validates user ID)");
	console.log(
		"- GET /tenants/premium/services/auth/data (multi-wildcard routing)",
	);
	console.log("- GET /legacy/some/endpoint (simple passthrough)");

	await exampleProxyConfig.start();
}
