import { z } from "zod";
import { createRoute } from "../../../../src";
import { getBucketById, singleBucketSchema } from "../../../lib/storage";

export const GET = createRoute({
	method: "GET",
	handler: async ({ params }) => {
		const bucket = getBucketById(params.id);

		if (!bucket) {
			return Response.json({ error: "Bucket not found" }, { status: 404 });
		}

		return Response.json(bucket);
	},
	spec: {
		format: "json",
		tags: ["Storage"],
		summary: "Get storage bucket details",
		description:
			"Retrieve detailed information about a specific storage bucket",
		parameters: {
			path: z.object({
				id: z.string().describe("The unique identifier of the storage bucket"),
			}),
		},
		responses: {
			200: {
				schema: singleBucketSchema,
			},
			404: {
				schema: z.object({
					error: z.string().default("Not Found"),
					message: z
						.string()
						.default("The requested storage bucket was not found"),
				}),
			},
		},
	},
});
