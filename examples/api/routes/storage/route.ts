import { createRoute } from "../../../../";
import { createBucket } from "./service";

export const GET = createRoute({
	method: "GET",
	callback: async () => {
		const buckets = ["bucket1", "bucket2", "bucket3"];
		return Response.json(buckets);
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
});
