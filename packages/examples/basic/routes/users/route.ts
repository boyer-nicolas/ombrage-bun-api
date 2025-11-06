import { createRoute } from "ombrage-bun-api";
import { z } from "zod";

// Get all users with optional filtering
export const GET = createRoute({
	method: "GET",
	handler: async ({ query }) => {
		const { limit, search } = query;

		// Mock users data
		const users = [
			{ id: "1", name: "John Doe", email: "john@example.com" },
			{ id: "2", name: "Jane Smith", email: "jane@example.com" },
			{ id: "3", name: "Bob Johnson", email: "bob@example.com" },
		];

		let filteredUsers = users;

		if (search) {
			filteredUsers = users.filter(
				(user) =>
					user.name.toLowerCase().includes(search.toLowerCase()) ||
					user.email.toLowerCase().includes(search.toLowerCase()),
			);
		}

		if (limit) {
			filteredUsers = filteredUsers.slice(0, limit);
		}

		return Response.json({
			users: filteredUsers,
			total: filteredUsers.length,
		});
	},
	spec: {
		format: "json",
		tags: ["Users"],
		summary: "Get all users",
		description: "Retrieve all users with optional filtering and pagination",
		parameters: {
			query: z.object({
				limit: z.coerce
					.number()
					.min(1)
					.max(100)
					.default(10)
					.describe("Maximum number of users to return"),
				search: z
					.string()
					.optional()
					.describe("Search term to filter users by name or email"),
			}),
		},
		responses: {
			200: {
				schema: z.object({
					users: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							email: z.string(),
						}),
					),
					total: z.number(),
				}),
			},
		},
	},
});

// Create a new user
export const POST = createRoute({
	method: "POST",
	handler: async ({ body }) => {
		const { name, email } = body;

		// Mock user creation
		const newUser = {
			id: String(Date.now()), // Simple ID generation for demo
			name,
			email,
			createdAt: new Date().toISOString(),
		};

		return Response.json(newUser, { status: 201 });
	},
	spec: {
		format: "json",
		tags: ["Users"],
		summary: "Create user",
		description: "Create a new user with the provided information",
		parameters: {
			body: z.object({
				name: z.string().min(1).max(100).describe("User's full name"),
				email: z.string().email().describe("User's email address"),
			}),
		},
		responses: {
			201: {
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
