import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

// Get user by ID
export const GET = createRoute({
	method: "GET",
	handler: async ({ params }) => {
		const { id } = params;

		// Mock user data
		const user = {
			id,
			name: `User ${id}`,
			email: `user${id}@example.com`,
			createdAt: new Date().toISOString(),
		};

		return Response.json(user);
	},
	spec: {
		format: "json",
		tags: ["Users"],
		summary: "Get user by ID",
		description: "Retrieve a specific user by their unique identifier",
		parameters: {
			path: z.object({
				id: z.string().describe("User ID"),
			}),
		},
		responses: {
			200: {
				schema: z.object({
					id: z.string(),
					name: z.string(),
					email: z.string(),
					createdAt: z.string(),
				}),
			},
		},
	},
});

// Update user
export const PUT = createRoute({
	method: "PUT",
	handler: async ({ params, body }) => {
		const { id } = params;
		const { name, email } = body;

		// Mock update
		const updatedUser = {
			id,
			name: name || `User ${id}`,
			email: email || `user${id}@example.com`,
			updatedAt: new Date().toISOString(),
		};

		return Response.json(updatedUser);
	},
	spec: {
		format: "json",
		tags: ["Users"],
		summary: "Update user",
		description: "Update an existing user's information",
		parameters: {
			path: z.object({
				id: z.string().describe("User ID to update"),
			}),
			body: z
				.object({
					name: z.string().optional().describe("User's name"),
					email: z.string().email().optional().describe("User's email"),
				})
				.refine((data) => Object.keys(data).length > 0, {
					message: "At least one field must be provided for update",
				}),
		},
		responses: {
			200: {
				schema: z.object({
					id: z.string(),
					name: z.string(),
					email: z.string(),
					updatedAt: z.string(),
				}),
			},
		},
	},
});
