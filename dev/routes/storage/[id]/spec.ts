import { singleBucketSchema } from "@dev/lib/storage";
import { defineSpec } from "src";
import { z } from "zod";

export const spec = defineSpec({
	get: {
		format: "json",
		parameters: {
			path: z.object({
				id: z.string().describe("The bucket ID"),
			}),
		},
		responses: {
			200: {
				summary: "Storage bucket details",
				description: "Details of the storage bucket",
				schema: singleBucketSchema,
			},
			404: {
				summary: "Bucket not found",
				description: "The requested bucket was not found",
				schema: z.object({
					error: z.string().default("Bucket not found"),
				}),
			},
		},
	},
});
