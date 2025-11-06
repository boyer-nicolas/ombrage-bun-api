import { z } from "zod";
import { createRoute } from "../../../../src";

export const GET = createRoute({
	method: "GET",
	handler: async () => {
		return Response.json({
			message: "Test fixture route",
			timestamp: new Date().toISOString(),
		});
	},
	spec: {
		format: "json",
		tags: ["Test"],
		summary: "Test fixture",
		description: "Simple test route for testing framework functionality",
		responses: {
			200: {
				schema: z.object({
					message: z.string(),
					timestamp: z.string(),
				}),
			},
		},
	},
});
