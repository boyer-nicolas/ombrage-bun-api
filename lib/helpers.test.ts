import { describe, expect, test } from "bun:test";
import type { OpenAPIV3_1 } from "openapi-types";
import {
	type CreateRouteProps,
	createRoute,
	defineSpec,
	type RouteProps,
} from "./helpers";

describe("helpers.ts", () => {
	describe("createRoute", () => {
		test("should create a route object with method and callback", () => {
			const mockCallback = async ({ request }: RouteProps) => {
				return new Response("test");
			};

			const routeProps: CreateRouteProps = {
				method: "GET",
				callback: mockCallback,
			};

			const result = createRoute(routeProps);

			expect(result).toEqual({
				method: "GET",
				callback: mockCallback,
			});
		});

		test("should create a route object with only method when callback is undefined", () => {
			const routeProps: CreateRouteProps = {
				method: "POST",
			};

			const result = createRoute(routeProps);

			expect(result).toEqual({
				method: "POST",
				callback: undefined,
			});
		});

		test("should handle all HTTP methods", () => {
			const methods: Array<CreateRouteProps["method"]> = [
				"GET",
				"POST",
				"PUT",
				"DELETE",
				"PATCH",
			];

			methods.forEach((method) => {
				const result = createRoute({ method });
				expect(result.method).toBe(method);
			});
		});

		test("should preserve callback function reference", () => {
			const mockCallback = async ({ request }: RouteProps) => {
				const url = new URL(request.url);
				return Response.json({ path: url.pathname });
			};

			const result = createRoute({
				method: "GET",
				callback: mockCallback,
			});

			expect(result.callback).toBe(mockCallback);
			expect(typeof result.callback).toBe("function");
		});
	});

	describe("defineSpec", () => {
		test("should return the same spec object passed to it", () => {
			const mockSpec: OpenAPIV3_1.PathsObject = {
				"/test": {
					get: {
						summary: "Test endpoint",
						responses: {
							"200": {
								description: "Success",
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												message: {
													type: "string",
												},
											},
										},
									},
								},
							},
						},
					},
				},
			};

			const result = defineSpec(mockSpec);

			expect(result).toBe(mockSpec);
			expect(result).toEqual(mockSpec);
		});

		test("should handle empty spec object", () => {
			const emptySpec: OpenAPIV3_1.PathsObject = {};
			const result = defineSpec(emptySpec);

			expect(result).toBe(emptySpec);
			expect(result).toEqual({});
		});

		test("should handle complex spec with multiple paths and methods", () => {
			const complexSpec: OpenAPIV3_1.PathsObject = {
				"/users": {
					get: {
						summary: "List users",
						responses: {
							"200": {
								description: "List of users",
								content: {
									"application/json": {
										schema: {
											type: "array",
											items: {
												type: "object",
												properties: {
													id: { type: "string" },
													name: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
					},
					post: {
						summary: "Create user",
						requestBody: {
							required: true,
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											name: { type: "string" },
										},
										required: ["name"],
									},
								},
							},
						},
						responses: {
							"201": {
								description: "User created",
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												id: { type: "string" },
												name: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
				},
				"/users/{id}": {
					get: {
						summary: "Get user by ID",
						parameters: [
							{
								name: "id",
								in: "path",
								required: true,
								schema: {
									type: "string",
								},
							},
						],
						responses: {
							"200": {
								description: "User details",
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												id: { type: "string" },
												name: { type: "string" },
											},
										},
									},
								},
							},
							"404": {
								description: "User not found",
							},
						},
					},
				},
			};

			const result = defineSpec(complexSpec);

			expect(result).toBe(complexSpec);
			expect(result).toEqual(complexSpec);
		});
	});

	describe("Type definitions", () => {
		test("RouteProps should include request and optional validator", () => {
			// This test ensures the types are properly defined
			const mockProps: RouteProps = {
				request: new Request("http://localhost:3000/test"),
			};

			expect(mockProps.request).toBeInstanceOf(Request);
			expect(mockProps.validator).toBeUndefined();

			const mockPropsWithValidator: RouteProps = {
				request: new Request("http://localhost:3000/test"),
				validator: { schema: "test" },
			};

			expect(mockPropsWithValidator.request).toBeInstanceOf(Request);
			expect(mockPropsWithValidator.validator).toEqual({ schema: "test" });
		});

		test("CreateRouteProps should include method and optional callback", () => {
			const mockProps: CreateRouteProps = {
				method: "GET",
			};

			expect(mockProps.method).toBe("GET");
			expect(mockProps.callback).toBeUndefined();

			const mockPropsWithCallback: CreateRouteProps = {
				method: "POST",
				callback: async () => new Response("test"),
			};

			expect(mockPropsWithCallback.method).toBe("POST");
			expect(typeof mockPropsWithCallback.callback).toBe("function");
		});
	});
});
