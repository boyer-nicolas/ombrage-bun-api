import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

const dashboardResponseSchema = z.object({
	message: z.string(),
	data: z.object({
		user: z.object({
			id: z.string(),
			email: z.string(),
			name: z.string(),
		}),
		stats: z.object({
			loginCount: z.number(),
			lastLogin: z.string(),
		}),
	}),
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

		// Mock some dashboard data
		return Response.json({
			message: "Dashboard data retrieved successfully",
			data: {
				user: {
					id: userId,
					email: userEmail,
					name: userName,
				},
				stats: {
					loginCount: Math.floor(Math.random() * 100) + 1,
					lastLogin: new Date().toISOString(),
				},
			},
		});
	},
	spec: {
		format: "json",
		tags: ["Protected", "Dashboard"],
		summary: "Get user dashboard",
		description: "Returns dashboard data for authenticated user",
		responses: {
			200: {
				description: "Dashboard data",
				schema: dashboardResponseSchema,
			},
			401: {
				description: "Unauthorized - invalid or missing session",
				schema: z.object({
					error: z.string(),
				}),
			},
			500: {
				description: "Server error",
				schema: z.object({
					error: z.string(),
				}),
			},
		},
	},
});
