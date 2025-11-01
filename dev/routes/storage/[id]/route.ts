import { z } from "zod";
import { createRoute } from "../../../../src";
import { getBucketById, singleBucketSchema } from "../../../lib/storage";

export const GET = createRoute({
	method: "GET",
	callback: async ({ params }) => {
		const bucket = getBucketById(params.id);

		if (!bucket) {
			return Response.json({ error: "Bucket not found" }, { status: 404 });
		}

		return Response.json(bucket);
	},
	spec: {
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
