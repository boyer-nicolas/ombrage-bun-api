import z from "zod";
import { createRoute } from "../../../src";

export const GET = createRoute({
	method: "GET",
	callback: async () => {
		return new Response("OK");
	},
	spec: {
		format: "text",
		tags: ["Utilities"],
		summary: "Health check",
		description: "Checks the health status of the storage service",
		responses: {
			200: {
				schema: z.string().default("OK"),
			},
			500: {
				schema: z.string().default("NOT OK => <reason>"),
			},
		},
	},
});
