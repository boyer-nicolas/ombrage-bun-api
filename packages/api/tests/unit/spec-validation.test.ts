import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import z from "zod";
import { resetConfig, validateConfig } from "../../src/lib/config";
import { createRoute, type SpecItem } from "../../src/lib/helpers";

describe("createRoute with spec validation", () => {
	beforeEach(() => {
		// Initialize config for createRoute to use
		validateConfig({
			server: {
				routes: {
					dir: "./test-routes",
				},
			},
		});
	});

	afterEach(() => {
		// Reset config state after each test
		resetConfig();
	});

	test("should throw error when response status doesn't match spec", async () => {
		const mockSpec: SpecItem = {
			format: "json",
			summary: "Created",
			description: "Created successfully",
			responses: {
				201: {
					schema: z.object({
						success: z.boolean(),
					}),
				},
			},
		};

		const route = createRoute({
			method: "POST",
			handler: async () => {
				// This returns 200 but spec expects 201
				return Response.json({ success: true });
			},
			spec: mockSpec,
		});

		const request = new Request("http://localhost/test", { method: "POST" });

		// Test the handler directly as an async function
		if (route.handler) {
			const mockProps = {
				request,
				params: {},
				query: {},
				headers: {},
				body: undefined,
			};
			await expect(route.handler(mockProps)).rejects.toThrow();
		}
	});

	test("should not throw error when response status matches spec", async () => {
		const mockSpec: SpecItem = {
			format: "json",
			summary: "Success",
			description: "Success response",
			responses: {
				"200": {
					schema: z.object({
						success: z.boolean(),
					}),
				},
			},
		};

		const route = createRoute({
			method: "GET",
			handler: async () => {
				// This returns 200 and spec expects 200
				return Response.json({ success: true });
			},
			spec: mockSpec,
		});

		const request = new Request("http://localhost/test", { method: "GET" });

		// This should not throw an error
		let response: Response | undefined;
		expect(async () => {
			if (route.handler) {
				const mockProps = {
					request,
					params: {},
					query: {},
					headers: {},
					body: undefined,
				};
				response = await route.handler(mockProps);
			}
		}).not.toThrow();

		expect(response?.status).toBe(200);
	});

	test("should work without spec validation", async () => {
		const route = createRoute({
			method: "GET",
			handler: async () => {
				return Response.json({ success: true });
			},
			// No spec provided
		});

		const request = new Request("http://localhost/test", { method: "GET" });

		// This should not throw an error even without spec
		let response: Response | undefined;
		await expect(async () => {
			if (route.handler) {
				const mockProps = {
					request,
					params: {},
					query: {},
					headers: {},
					body: undefined,
				};
				response = await route.handler(mockProps);
			}
		}).not.toThrow();

		expect(response?.status).toBe(200);
	});
});
