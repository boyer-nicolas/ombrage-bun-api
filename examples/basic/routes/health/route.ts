import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

// Health check endpoint
export const GET = createRoute({
	method: "GET",
	callback: async () => {
		return Response.json({
			status: "healthy",
			timestamp: new Date().toISOString(),
			service: "example-api",
		});
	},
	spec: {
		format: "json",
		tags: ["Health"],
		summary: "Service is healthy",
		description: "Health check endpoint that returns service status",
		responses: {
			200: {
				schema: z.object({
					status: z.string(),
					timestamp: z.string(),
					service: z.string(),
				}),
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
			receivedAt: new Date().toISOString(),
		});
	},
	spec: {
		format: "json",
		tags: ["Health"],
		summary: "Echo message",
		description: "Echo back a message with timestamp",
		parameters: {
			body: z.object({
				message: z.string().describe("Message to echo back"),
			}),
		},
		responses: {
			200: {
				schema: z.object({
					echo: z.string(),
					receivedAt: z.string(),
				}),
			},
		},
	},
});
