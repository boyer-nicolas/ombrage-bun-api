import z from "zod";

export const singleBucketSchema = z.object({
	id: z.string().default("bucket-id"),
	name: z.string().min(2).max(100),
	createdAt: z.date().default(new Date()),
	updatedAt: z.date().default(new Date()),
});

export type SingleBucket = z.infer<typeof singleBucketSchema>;

export const bucketListSchema = z.array(singleBucketSchema).default([
	{
		id: "bucket1",
		name: "Bucket 1",
		createdAt: new Date(),
		updatedAt: new Date(),
	},
	{
		id: "bucket2",
		name: "Bucket 2",
		createdAt: new Date(),
		updatedAt: new Date(),
	},
]);

export type BucketList = z.infer<typeof bucketListSchema>;

export const createBucketSchema = z.object({
	name: z.string().min(2).max(100),
});

export type CreateBucketInput = z.infer<typeof createBucketSchema>;

export function listBuckets(): BucketList {
	return [
		{
			id: "bucket1",
			name: "Bucket 1",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "bucket2",
			name: "Bucket 2",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: "bucket3",
			name: "Bucket 3",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];
}

export function createBucket(name: string): SingleBucket {
	return { id: "bucket4", name, createdAt: new Date(), updatedAt: new Date() };
}

export function getBucketById(id: string): SingleBucket | null {
	const buckets = listBuckets();
	return buckets.find((bucket) => bucket.id === id) || null;
}
