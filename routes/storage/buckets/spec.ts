export const bucketSpec = {
	"/storage/buckets": {
		get: {
			summary: "List all storage buckets",
			description: "Retrieves a list of all available storage buckets",
			responses: {
				"200": {
					description: "List of bucket names",
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
				"500": {
					description: "Internal server error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									error: { type: "string" },
									message: { type: "string" },
									status: { type: "number" },
								},
							},
						},
					},
				},
			},
		},
		post: {
			summary: "Create a new storage bucket",
			description: "Creates a new storage bucket with the specified name",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								name: {
									type: "string",
									description: "The name of the bucket to create",
								},
							},
							required: ["name"],
						},
					},
				},
			},
			responses: {
				"200": {
					description: "Bucket created successfully",
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
									status: { type: "number" },
								},
							},
						},
					},
				},
				"500": {
					description: "Internal server error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									error: { type: "string" },
									message: { type: "string" },
									status: { type: "number" },
								},
							},
						},
					},
				},
			},
		},
	},
};
