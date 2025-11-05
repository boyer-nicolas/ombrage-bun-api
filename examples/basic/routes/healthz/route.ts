import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

// Health check endpoint
export const GET = createRoute({
	method: "GET",
	callback: async () => {
		return new Response("OK");
	},
	spec: {
		format: "text",
		tags: ["Health"],
		summary: "Service is healthy",
		description: "Health check endpoint that returns service status",
		responses: {
			200: {
				schema: z.string().default("OK"),
			},
		},
	},
});

// Example POST endpoint with validation
export const POST = createRoute({
	method: "POST",
	callback: async ({ body }) => {
		const { message } = body;

		return Response.json({
			echo: message,
		});
	},
	spec: {
		format: "json",
		tags: ["Health"],
		summary: "Echo message",
		description: "Echo back a message",
		parameters: {
			body: z.object({
				message: z.string().describe("Message to echo back"),
			}),
		},
		responses: {
			200: {
				schema: z.object({
					echo: z.string(),
				}),
			},
		},
	},
});
