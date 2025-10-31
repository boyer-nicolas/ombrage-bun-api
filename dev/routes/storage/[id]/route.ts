import { getBucketById } from "@dev/lib/storage";
import { createRoute } from "src";
import { spec } from "./spec";

export const GET = createRoute({
	method: "GET",
	callback: async ({ params }) => {
		if (!params?.id) {
			return Response.json({ error: "Missing id parameter" }, { status: 400 });
		}

		const bucket = getBucketById(params.id);

		if (!bucket) {
			return Response.json({ error: "Bucket not found" }, { status: 404 });
		}

		return Response.json(bucket);
	},
	spec: spec.get,
});
