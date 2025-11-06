import { z } from "zod";
import { createRoute } from "../../../src";

export const GET = createRoute({
	method: "GET",
	handler: async () => {
		return Response.json({
			message: "Local route - this won't be proxied",
			timestamp: new Date().toISOString(),
			routes: [
				"Try these proxy examples:",
				"GET /api/protected/users (requires 'Authorization: Bearer valid-token-123')",
				"GET /api/public/status (logs request and proxies)",
				"GET /users/123/profile (validates user ID)",
				"GET /tenants/premium/services/auth/data (multi-wildcard routing)",
				"GET /legacy/some/endpoint (simple passthrough)",
			],
		});
	},
	spec: {
		format: "json",
		tags: ["Examples"],
		summary: "Proxy examples info",
		description:
			"Returns information about available proxy endpoints for testing",
		responses: {
			200: {
				schema: z.object({
					message: z.string(),
					timestamp: z.string(),
					routes: z.array(z.string()),
				}),
			},
		},
	},
});
