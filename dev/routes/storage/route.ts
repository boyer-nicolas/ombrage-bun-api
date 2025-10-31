import { createRoute } from "@lib/helpers";
import { createBucket, listBuckets } from "../../lib/storage";
import { spec } from "./spec";

export const GET = createRoute({
	method: "GET",
	callback: async () => {
		const buckets = listBuckets();
		return Response.json(buckets);
	},
	spec,
});

export const POST = createRoute({
	method: "POST",
	callback: async ({ body }) => {
		const bucket = createBucket(body.name);
		return Response.json(bucket, {
			status: 201,
		});
	},
	spec,
});
