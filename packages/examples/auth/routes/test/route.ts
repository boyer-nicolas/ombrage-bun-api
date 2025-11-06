import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

const testResponseSchema = z.object({
	message: z.string(),
	timestamp: z.string(),
	environment: z.string(),
	status: z.literal("ok"),
});

export const GET = createRoute({
	method: "GET",
	handler: async () => {
		return Response.json({
			message: "Test endpoint is working",
			timestamp: new Date().toISOString(),
			environment: process.env.NODE_ENV || "development",
			status: "ok",
		});
	},
	spec: {
		format: "json",
		tags: ["Test"],
		summary: "Test endpoint",
		description:
			"A simple test endpoint that returns server status and timestamp",
		responses: {
			200: {
				description: "Test response with server information",
				schema: testResponseSchema,
			},
		},
	},
});
