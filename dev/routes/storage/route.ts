import { z } from "zod";
import { createRoute } from "../../../src";
import {
	bucketListSchema,
	createBucket,
	createBucketSchema,
	listBuckets,
} from "../../lib/storage";

export const GET = createRoute({
	method: "GET",
	callback: async () => {
		const buckets = listBuckets();
		return Response.json(buckets);
	},
	spec: {
		format: "json",
		responses: {
			200: {
				summary: "List all storage items",
				description: "Retrieves a list of all available storage items",
				schema: bucketListSchema,
			},
		},
	},
});

export const POST = createRoute({
	method: "POST",
	callback: async ({ body }) => {
		const bucket = createBucket(body.name);
		return Response.json(bucket, {
			status: 201,
		});
	},
	spec: {
		format: "json",
		parameters: {
			body: z.object({
				name: z.string().describe("The name of the storage bucket"),
			}),
		},
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
