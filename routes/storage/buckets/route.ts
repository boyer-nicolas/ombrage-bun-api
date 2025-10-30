import { RouteInterface } from "@lib/route-interface";
import { BucketService } from "@routes/storage/buckets/service";

export class StorageBucketRoute extends RouteInterface<BucketService> {
  constructor(service: BucketService) {
    super(service);
  }
}

export const GET = async (request: Request) => {
  const buckets = await this.service.listBuckets();
  return Response.json(buckets);
};

export const POST = async (request: Request) => {
  const body = await request.json();
  const bucket = await this.service.createBucket(body.name);
  return Response.json(bucket);
};
