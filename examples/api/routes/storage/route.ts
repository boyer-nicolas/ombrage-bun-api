import { createRoute } from "../../../../";
import { createBucket } from "./service";
import spec from "./spec";

export const GET = createRoute({
	method: "GET",
	callback: async () => {
		const buckets = ["bucket1", "bucket2", "bucket3"];
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
