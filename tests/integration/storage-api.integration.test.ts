import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { OpenAPIV3_1 } from "openapi-types";
import { AppConfig } from "../../src/lib/config";
import { type OmbrageServer, Server } from "../../src/lib/server";

describe("Storage API Integration Tests", () => {
	let server: OmbrageServer;
	let baseURL: string;

	beforeAll(async () => {
		// Set test environment variables
		(Bun.env as Record<string, string | undefined>).ENVIRONMENT = "test";
		(Bun.env as Record<string, string | undefined>).LOG_LEVEL = "error";
		(Bun.env as Record<string, string | undefined>).AUTH_SECRET =
			"test-secret-for-integration-tests";

		AppConfig.load();

		// Start server with dev routes on a random available port
		const serverInstance = new Server({
			server: {
				routesDir: "./dev/routes",
				port: 0,
			},
		});

		server = await serverInstance.start();

		baseURL = `http://${server.hostname}:${server.port}`;

		console.log(`Test server started at ${baseURL}`);
	});

	afterAll(async () => {
		if (server) {
			server.stop();
		}
	});

	describe("GET /storage", () => {
		test("should return list of storage buckets", async () => {
			const response = await fetch(`${baseURL}/storage`);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);

			// biome-ignore lint/suspicious/noExplicitAny: Required for testing
			const buckets = (await response.json()) as any[];
			expect(Array.isArray(buckets)).toBe(true);
			expect(buckets.length).toBeGreaterThan(0);

			// Validate bucket structure
			const firstBucket = buckets[0];
			expect(firstBucket).toHaveProperty("id");
			expect(firstBucket).toHaveProperty("name");
			expect(firstBucket).toHaveProperty("createdAt");
			expect(firstBucket).toHaveProperty("updatedAt");
		});

		test("should have proper OpenAPI documentation", async () => {
			const response = await fetch(`${baseURL}/api-docs.json`);
			const spec = (await response.json()) as OpenAPIV3_1.Document;

			expect(spec.paths).toBeDefined();
			if (!spec.paths) throw new Error("spec.paths is undefined");
			expect(spec.paths).toHaveProperty("/storage");
			expect(spec.paths["/storage"]).toHaveProperty("get");

			const getSpec = spec.paths["/storage"]?.get;
			expect(getSpec).toBeDefined();
			if (!getSpec) throw new Error("getSpec is undefined");
			expect(getSpec).toHaveProperty("responses");
			expect(getSpec.responses).toHaveProperty("200");
		});
	});

	describe("POST /storage", () => {
		test("should create a new storage bucket with valid data", async () => {
			const newBucket = { name: "Test Bucket" };

			const response = await fetch(`${baseURL}/storage`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(newBucket),
			});

			expect(response.status).toBe(201);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);

			const createdBucket = await response.json();
			expect(createdBucket).toHaveProperty("id");
			expect(createdBucket).toHaveProperty("name", "Test Bucket");
			expect(createdBucket).toHaveProperty("createdAt");
			expect(createdBucket).toHaveProperty("updatedAt");
		});

		test("should validate request body schema", async () => {
			const invalidBucket = { invalidField: "value" };

			const response = await fetch(`${baseURL}/storage`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(invalidBucket),
			});

			expect(response.status).toBe(500); // Validation error

			const error = await response.json();
			expect(error).toHaveProperty("error");
		});

		test("should handle malformed JSON", async () => {
			const response = await fetch(`${baseURL}/storage`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: "invalid json{",
			});

			expect([400, 500]).toContain(response.status);
		});

		test("should handle missing content-type header", async () => {
			const response = await fetch(`${baseURL}/storage`, {
				method: "POST",
				body: JSON.stringify({ name: "Test Bucket" }),
			});

			// Should still work but body will be undefined
			expect([201, 500]).toContain(response.status);
		});
	});

	describe("GET /storage/{id}", () => {
		test("should return specific bucket by id", async () => {
			const response = await fetch(`${baseURL}/storage/bucket1`);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);

			const bucket = await response.json();
			expect(bucket).toHaveProperty("id", "bucket1");
			expect(bucket).toHaveProperty("name");
			expect(bucket).toHaveProperty("createdAt");
			expect(bucket).toHaveProperty("updatedAt");
		});

		test("should return 404 for non-existent bucket", async () => {
			const response = await fetch(`${baseURL}/storage/nonexistent`);

			expect(response.status).toBe(404);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);

			const error = await response.json();
			expect(error).toHaveProperty("error", "Bucket not found");
		});

		test("should have proper path parameter validation", async () => {
			const response = await fetch(`${baseURL}/api-docs.json`);
			const spec = (await response.json()) as OpenAPIV3_1.Document;

			expect(spec.paths).toHaveProperty("/storage/{id}");
			expect(spec.paths).toBeDefined();
			if (!spec.paths) throw new Error("spec.paths is undefined");
			expect(spec.paths["/storage/{id}"]).toHaveProperty("get");

			const getSpec = spec.paths["/storage/{id}"]?.get;
			expect(getSpec).toBeDefined();
			if (!getSpec) throw new Error("getSpec is undefined");
			expect(getSpec).toHaveProperty("parameters");

			const pathParam = getSpec.parameters?.find(
				(p) => "in" in p && "name" in p && p.in === "path" && p.name === "id",
			);
			expect(pathParam).toBeDefined();
			if (!pathParam) throw new Error("pathParam is undefined");
			if ("required" in pathParam) {
				expect(pathParam.required).toBe(true);
			}
		});
	});

	describe("Content negotiation", () => {
		test("should handle Accept header for JSON", async () => {
			const response = await fetch(`${baseURL}/storage`, {
				headers: {
					Accept: "application/json",
				},
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);
		});

		test("should handle Accept header for any content type", async () => {
			const response = await fetch(`${baseURL}/storage`, {
				headers: {
					Accept: "*/*",
				},
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain(
				"application/json",
			);
		});
	});

	describe("Error handling", () => {
		test("should return proper error format for 404", async () => {
			const response = await fetch(`${baseURL}/storage/nonexistent`);

			expect(response.status).toBe(404);

			const error = await response.json();
			expect(error).toHaveProperty("error");
			// biome-ignore lint/suspicious/noExplicitAny: Testing
			expect(typeof (error as any).error).toBe("string");
		});

		test("should return proper error format for 405 Method Not Allowed", async () => {
			const response = await fetch(`${baseURL}/storage/bucket1`, {
				method: "DELETE", // Not implemented
			});

			expect(response.status).toBe(405);

			const error = await response.json();
			expect(error).toHaveProperty("error", "Method Not Allowed");
			expect(error).toHaveProperty("message");
			expect(error).toHaveProperty("status", 405);
		});
	});
});
