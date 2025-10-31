import { bucketListSchema, createBucketSchema } from "@dev/lib/storage";
import { defineSpec } from "src";
import { z } from "zod";

export const spec = defineSpec({
	get: {
		format: "json",
		responses: {
			200: {
				summary: "List all storage items",
				description: "Retrieves a list of all available storage items",
				schema: bucketListSchema,
			},
		},
	},
	post: {
		format: "json",
		responses: {
			201: {
				summary: "Storage item created successfully",
				description: "The storage item was created successfully",
				schema: createBucketSchema,
			},
			400: {
				summary: "Bad request - missing or invalid data",
				description:
					"The request body is missing required fields or has invalid data",
				schema: z.object({
					error: z.string().default("Invalid request"),
					message: z
						.string()
						.default(
							"The request body is missing required fields or has invalid data",
						),
				}),
			},
		},
	},
});
