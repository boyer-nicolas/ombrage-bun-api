import { defineSpec } from "../../../..";

export default defineSpec({
	get: {
		response: {
			status: 200,
			body: ["bucket1", "bucket2", "bucket3"],
		},
	},
	post: {
		request: {
			body: {
				name: "new-bucket",
			},
		},
		response: {
			status: 201,
			body: {
				name: "new-bucket",
				created: true,
			},
		},
	},
});
