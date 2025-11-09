import { z } from "zod";
import { createRoute } from "../../../src";

export const GET = createRoute({
	method: "GET",
	handler: async () => {
		return Response.json({
			message: "Hello from CORS-enabled API!",
			timestamp: new Date().toISOString(),
			headers: "CORS headers are automatically added by the framework",
		});
	},
	spec: {
		format: "json",
		tags: ["CORS", "Demo"],
		summary: "CORS demonstration endpoint",
		responses: {
			200: {
				schema: z.object({
					message: z.string(),
					timestamp: z.string(),
					headers: z.string(),
				}),
			},
		},
	},
});

export const POST = createRoute({
	method: "POST",
	handler: async ({ body }) => {
		return Response.json({
			message: "POST request received with CORS support",
			receivedData: body,
			timestamp: new Date().toISOString(),
		});
	},
	spec: {
		format: "json",
		tags: ["CORS", "Demo"],
		summary: "CORS POST demonstration",
		parameters: {
			body: z.object({
				name: z.string().optional(),
				data: z.any().optional(),
			}),
		},
		responses: {
			200: {
				schema: z.object({
					message: z.string(),
					receivedData: z.any(),
					timestamp: z.string(),
				}),
			},
		},
	},
});
