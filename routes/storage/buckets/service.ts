export class BucketService {
  async listBuckets() {
    return ["bucket1", "bucket2", "bucket3"];
  }

  async createBucket(name: string) {
    return { name, created: true };
  }
}
