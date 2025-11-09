import { describe, expect, test } from "bun:test";
import { Api } from "../../src";

describe("CORS Integration Tests", () => {
	test("should handle CORS preflight request", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "https://example.com",
				methods: ["GET", "POST", "PUT", "DELETE"],
				allowedHeaders: ["Content-Type", "Authorization"],
				credentials: true,
				maxAge: 3600,
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://example.com",
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "Content-Type, Authorization",
				},
			});

			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://example.com",
			);
			expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
				"GET, POST, PUT, DELETE",
			);
			expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
				"Content-Type, Authorization",
			);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
				"true",
			);
			expect(response.headers.get("Access-Control-Max-Age")).toBe("3600");
		} finally {
			server.stop();
		}
	});

	test("should add CORS headers to regular responses", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: ["https://example.com", "https://app.com"],
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: true,
				exposedHeaders: ["X-Total-Count"],
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				headers: {
					Origin: "https://example.com",
				},
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://example.com",
			);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
				"true",
			);
			expect(response.headers.get("Access-Control-Expose-Headers")).toBe(
				"X-Total-Count",
			);

			// Should not include preflight-specific headers
			expect(response.headers.get("Access-Control-Allow-Methods")).toBeNull();
			expect(response.headers.get("Access-Control-Allow-Headers")).toBeNull();
		} finally {
			server.stop();
		}
	});

	test("should reject preflight with disallowed origin", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "https://allowed.com", // Only this origin is allowed
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://not-allowed.com", // Different origin
					"Access-Control-Request-Method": "GET",
				},
			});

			// Should still respond to preflight, but without CORS headers for disallowed origin
			expect(response.status).toBe(204);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
		} finally {
			server.stop();
		}
	});

	test("should reject preflight with disallowed method", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "*",
				methods: ["GET", "POST"], // DELETE not allowed
				allowedHeaders: ["Content-Type"],
				credentials: false,
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://example.com",
					"Access-Control-Request-Method": "DELETE", // Not allowed
				},
			});

			expect(response.status).toBe(405); // Method Not Allowed
		} finally {
			server.stop();
		}
	});

	test("should reject preflight with disallowed headers", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"], // Only Content-Type allowed
				credentials: false,
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://example.com",
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "Content-Type, X-Custom-Header", // X-Custom-Header not allowed
				},
			});

			expect(response.status).toBe(403); // Forbidden
		} finally {
			server.stop();
		}
	});

	test("should handle wildcard origin correctly", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "*", // Allow all origins
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				headers: {
					Origin: "https://any-domain.com",
				},
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
			expect(
				response.headers.get("Access-Control-Allow-Credentials"),
			).toBeNull();
		} finally {
			server.stop();
		}
	});

	test("should handle credentials with wildcard correctly", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: true, // Credentials with wildcard
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				headers: {
					Origin: "https://example.com",
				},
			});

			expect(response.status).toBe(200);
			// When credentials are enabled, should use actual origin instead of *
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://example.com",
			);
			expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
				"true",
			);
		} finally {
			server.stop();
		}
	});

	test("should work with custom options success status", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
				optionsSuccessStatus: 200, // Custom status
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://example.com",
					"Access-Control-Request-Method": "GET",
				},
			});

			expect(response.status).toBe(200); // Custom status instead of default 204
		} finally {
			server.stop();
		}
	});

	test("should not add CORS headers when CORS is disabled", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: false, // CORS disabled
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				headers: {
					Origin: "https://example.com",
				},
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
			expect(
				response.headers.get("Access-Control-Allow-Credentials"),
			).toBeNull();
		} finally {
			server.stop();
		}
	});

	test("should not handle OPTIONS when CORS is disabled", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: false, // CORS disabled
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`, {
				method: "OPTIONS",
				headers: {
					Origin: "https://example.com",
					"Access-Control-Request-Method": "GET",
				},
			});

			// Should go to regular route handling instead of CORS preflight
			expect(response.status).toBe(405); // Method not allowed from route handler
		} finally {
			server.stop();
		}
	});

	test("should handle requests without origin header", async () => {
		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			cors: {
				enabled: true,
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			},
		});

		const server = await api.start();

		try {
			const response = await fetch(`http://localhost:${server.port}/test`);
			// No Origin header

			expect(response.status).toBe(200);
			expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		} finally {
			server.stop();
		}
	});
});
