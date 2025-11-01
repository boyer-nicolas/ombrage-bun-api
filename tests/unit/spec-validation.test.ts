import { describe, expect, test } from "bun:test";
import z from "zod";
import { createRoute, type SpecItem } from "../../src/lib/helpers";

describe("createRoute with spec validation", () => {
	test("should throw error when response status doesn't match spec", async () => {
		const mockSpec: SpecItem = {
			format: "json",
			responses: {
				201: {
					summary: "Created",
					description: "Created successfully",
					schema: z.object({
						success: z.boolean(),
					}),
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

		// Test the callback directly as an async function
		if (route.callback) {
			const mockProps = {
				request,
				params: {},
				query: {},
				headers: {},
				body: undefined,
			};
			await expect(route.callback(mockProps)).rejects.toThrow();
		}
	});

	test("should not throw error when response status matches spec", async () => {
		const mockSpec: SpecItem = {
			format: "json",
			responses: {
				"200": {
					summary: "Success",
					description: "Success response",
					schema: z.object({
						success: z.boolean(),
					}),
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
				const mockProps = {
					request,
					params: {},
					query: {},
					headers: {},
					body: undefined,
				};
				response = await route.callback(mockProps);
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
				const mockProps = {
					request,
					params: {},
					query: {},
					headers: {},
					body: undefined,
				};
				response = await route.callback(mockProps);
			}
		}).not.toThrow();

		expect(response?.status).toBe(200);
	});
});
