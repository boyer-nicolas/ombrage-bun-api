import { describe, expect, test } from "bun:test";
import { createRoute } from "../helpers";

describe("createRoute with spec validation", () => {
	test("should throw error when response status doesn't match spec", async () => {
		const mockSpec = {
			responses: {
				"201": {
					description: "Created successfully",
				},
			},
		};

		const route = createRoute({
			method: "POST",
			callback: async () => {
				// This returns 200 but spec expects 201
				return Response.json({ success: true });
			},
			spec: mockSpec,
		});

		const request = new Request("http://localhost/test", { method: "POST" });

		// This should throw an error in development environment
		process.env.ENVIRONMENT = "development";

		await expect(async () => {
			if (route.callback) {
				await route.callback({ request });
			}
		}).toThrow();
	});

	test("should not throw error when response status matches spec", async () => {
		const mockSpec = {
			responses: {
				"200": {
					description: "Success",
				},
			},
		};

		const route = createRoute({
			method: "GET",
			callback: async () => {
				// This returns 200 and spec expects 200
				return Response.json({ success: true });
			},
			spec: mockSpec,
		});

		const request = new Request("http://localhost/test", { method: "GET" });

		// This should not throw an error
		let response: Response | undefined;
		await expect(async () => {
			if (route.callback) {
				response = await route.callback({ request });
			}
		}).not.toThrow();

		expect(response?.status).toBe(200);
	});

	test("should work without spec validation", async () => {
		const route = createRoute({
			method: "GET",
			callback: async () => {
				return Response.json({ success: true });
			},
			// No spec provided
		});

		const request = new Request("http://localhost/test", { method: "GET" });

		// This should not throw an error even without spec
		let response: Response | undefined;
		await expect(async () => {
			if (route.callback) {
				response = await route.callback({ request });
			}
		}).not.toThrow();

		expect(response?.status).toBe(200);
	});
});
