import { createRoute } from "@lib/helpers";
import { createBucket, listBuckets } from "@routes/storage/buckets/service";
import spec from "@routes/storage/buckets/spec";

export const GET = createRoute({
	method: "GET",
	callback: async () => {
		const buckets = await listBuckets();
		return Response.json(buckets);
	},
	spec: spec.get,
});

export const POST = createRoute({
	method: "POST",
	callback: async ({ request }) => {
		const body: { name: string } = (await request.json()) as { name: string };
		const bucket = await createBucket(body.name);
		return Response.json(bucket, { status: 201 });
	},
	spec: spec.post,
});
