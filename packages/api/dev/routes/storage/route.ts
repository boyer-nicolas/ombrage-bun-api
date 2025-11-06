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
	handler: async () => {
		const buckets = listBuckets();
		return Response.json(buckets);
	},
	spec: {
		format: "json",
		tags: ["Storage"],
		summary: "List all storage items",
		description: "Retrieves a list of all available storage items",
		responses: {
			200: {
				schema: bucketListSchema,
			},
		},
	},
});

export const POST = createRoute({
	method: "POST",
	handler: async ({ body }) => {
		const bucket = createBucket(body.name);
		return Response.json(bucket, {
			status: 201,
		});
	},
	spec: {
		format: "json",
		tags: ["Storage"],
		summary: "Create storage item",
		description: "Create a new storage bucket with the specified name",
		parameters: {
			body: z.object({
				name: z.string().describe("The name of the storage bucket"),
			}),
		},
		responses: {
			201: {
				schema: createBucketSchema,
			},
			400: {
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
