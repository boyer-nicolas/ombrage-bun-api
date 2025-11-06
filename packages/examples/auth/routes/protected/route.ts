import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

const profileResponseSchema = z.object({
	message: z.string(),
	user: z.object({
		id: z.string(),
		email: z.string(),
		name: z.string(),
	}),
	timestamp: z.string(),
});

export const GET = createRoute({
	method: "GET",
	handler: async ({ request }) => {
		// User info is already validated and available in headers
		const userId = request.headers.get("x-user-id");
		const userEmail = request.headers.get("x-user-email");
		const userName = request.headers.get("x-user-name") || "";

		// These should always be present due to proxy authentication
		if (!userId || !userEmail) {
			return new Response("Missing user information", { status: 500 });
		}

		return Response.json({
			message: `Hello, ${userName}! This is a protected route.`,
			user: {
				id: userId,
				email: userEmail,
				name: userName,
			},
			timestamp: new Date().toISOString(),
		});
	},
	spec: {
		format: "json",
		tags: ["Protected"],
		summary: "Get user profile",
		description:
			"Returns authenticated user information from a protected route",
		responses: {
			200: {
				description: "User profile information",
				schema: profileResponseSchema,
			},
			401: {
				description: "Unauthorized - invalid or missing session",
				schema: z.object({
					error: z.string(),
				}),
			},
		},
	},
});
