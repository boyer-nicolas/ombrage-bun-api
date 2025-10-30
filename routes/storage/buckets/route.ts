import { Route } from "@lib/route";
import type { BucketService } from "@routes/storage/buckets/service";

export class StorageBucketRoute extends Route<BucketService> {
	public override GET = async () => {
		const buckets = await this.service.listBuckets();
		return Response.json(buckets);
	};

	public override POST = async ({ request }: { request: Request }) => {
		const body: { name: string } = (await request.json()) as { name: string };
		const bucket = await this.service.createBucket(body.name);
		return Response.json(bucket);
	};
}
