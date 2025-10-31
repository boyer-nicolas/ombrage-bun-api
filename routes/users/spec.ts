import { defineSpec } from "@lib/helpers";

export default defineSpec({
	get: {
		summary: "List all users",
		description: "Retrieves a list of all available users",
		responses: {
			"200": {
				description: "List of user names",
				content: {
					"application/json": {
						schema: {
							type: "array",
							items: {
								type: "string",
							},
						},
					},
				},
			},
		},
	},
	post: {
		summary: "Create a new user",
		description: "Creates a new user with the specified name",
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: {
							name: {
								type: "string",
								description: "The name of the user to create",
							},
						},
						required: ["name"],
					},
				},
			},
		},
		responses: {
			"201": {
				description: "User created successfully",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								name: { type: "string" },
								created: { type: "boolean" },
							},
						},
					},
				},
			},
			"400": {
				description: "Bad request - missing or invalid data",
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								error: { type: "string" },
								message: { type: "string" },
							},
						},
					},
				},
			},
		},
	},
});
