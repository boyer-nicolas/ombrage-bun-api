export async function listBuckets() {
	return ["bucket1", "bucket2", "bucket3"];
}

export async function createBucket(name: string) {
	return { name, created: true };
}
