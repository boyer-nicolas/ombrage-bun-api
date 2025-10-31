export function listBuckets() {
	return ["bucket1", "bucket2", "bucket3"];
}

export function createBucket(name: string) {
	return { name, created: true };
}
