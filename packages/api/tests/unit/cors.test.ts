import { describe, expect, test } from "bun:test";
import {
	addCorsHeaders,
	type CorsOptions,
	generateCorsHeaders,
	generateCorsPreflightHeaders,
	handleCorsPreflightRequest,
	isOriginAllowed,
} from "../../src/lib/helpers";

describe("CORS Helper Functions", () => {
	describe("isOriginAllowed", () => {
		test("should allow all origins when set to true", () => {
			expect(isOriginAllowed("https://example.com", true)).toBe(true);
			expect(isOriginAllowed("http://localhost:3000", true)).toBe(true);
			expect(isOriginAllowed("https://any-domain.com", true)).toBe(true);
		});

		test("should allow all origins when set to '*'", () => {
			expect(isOriginAllowed("https://example.com", "*")).toBe(true);
			expect(isOriginAllowed("http://localhost:3000", "*")).toBe(true);
		});

		test("should deny all origins when set to false", () => {
			expect(isOriginAllowed("https://example.com", false)).toBe(false);
			expect(isOriginAllowed("http://localhost:3000", false)).toBe(false);
		});

		test("should handle null origin", () => {
			expect(isOriginAllowed(null, true)).toBe(false);
			expect(isOriginAllowed(null, "*")).toBe(false);
			expect(isOriginAllowed(null, "https://example.com")).toBe(false);
			expect(isOriginAllowed(null, ["https://example.com"])).toBe(false);
		});

		test("should match exact string origin", () => {
			expect(
				isOriginAllowed("https://example.com", "https://example.com"),
			).toBe(true);
			expect(isOriginAllowed("https://example.com", "https://other.com")).toBe(
				false,
			);
		});

		test("should match origins in array", () => {
			const allowedOrigins = [
				"https://example.com",
				"http://localhost:3000",
				"https://app.com",
			];

			expect(isOriginAllowed("https://example.com", allowedOrigins)).toBe(true);
			expect(isOriginAllowed("http://localhost:3000", allowedOrigins)).toBe(
				true,
			);
			expect(isOriginAllowed("https://app.com", allowedOrigins)).toBe(true);
			expect(isOriginAllowed("https://notallowed.com", allowedOrigins)).toBe(
				false,
			);
		});
	});

	describe("generateCorsHeaders", () => {
		const mockRequest = new Request("https://api.example.com/test", {
			headers: { origin: "https://client.com" },
		});

		test("should generate basic CORS headers", () => {
			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const headers = generateCorsHeaders(mockRequest, corsOptions);

			expect(headers["Access-Control-Allow-Origin"]).toBe("https://client.com");
			expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
			expect(headers["Access-Control-Expose-Headers"]).toBeUndefined();
		});

		test("should include credentials header when credentials are enabled", () => {
			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: true,
			};

			const headers = generateCorsHeaders(mockRequest, corsOptions);

			expect(headers["Access-Control-Allow-Origin"]).toBe("https://client.com");
			expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
		});

		test("should include exposed headers", () => {
			const corsOptions: CorsOptions = {
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
				exposedHeaders: ["X-Total-Count", "X-Custom-Header"],
			};

			const headers = generateCorsHeaders(mockRequest, corsOptions);

			expect(headers["Access-Control-Expose-Headers"]).toBe(
				"X-Total-Count, X-Custom-Header",
			);
		});

		test("should handle wildcard origin with credentials", () => {
			const corsOptions: CorsOptions = {
				origin: true,
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: true,
			};

			const headers = generateCorsHeaders(mockRequest, corsOptions);

			// When credentials are enabled, should use actual origin instead of *
			expect(headers["Access-Control-Allow-Origin"]).toBe("https://client.com");
			expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
		});

		test("should handle missing origin header", () => {
			const requestWithoutOrigin = new Request("https://api.example.com/test");
			const corsOptions: CorsOptions = {
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const headers = generateCorsHeaders(requestWithoutOrigin, corsOptions);

			expect(headers["Access-Control-Allow-Origin"]).toBe("*");
		});
	});

	describe("generateCorsPreflightHeaders", () => {
		const mockRequest = new Request("https://api.example.com/test", {
			headers: { origin: "https://client.com" },
		});

		test("should generate preflight headers", () => {
			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST", "PUT", "DELETE"],
				allowedHeaders: ["Content-Type", "Authorization"],
				credentials: true,
				maxAge: 3600,
			};

			const headers = generateCorsPreflightHeaders(mockRequest, corsOptions);

			expect(headers["Access-Control-Allow-Origin"]).toBe("https://client.com");
			expect(headers["Access-Control-Allow-Methods"]).toBe(
				"GET, POST, PUT, DELETE",
			);
			expect(headers["Access-Control-Allow-Headers"]).toBe(
				"Content-Type, Authorization",
			);
			expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
			expect(headers["Access-Control-Max-Age"]).toBe("3600");
		});

		test("should not include max-age when undefined", () => {
			const corsOptions: CorsOptions = {
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const headers = generateCorsPreflightHeaders(mockRequest, corsOptions);

			expect(headers["Access-Control-Max-Age"]).toBeUndefined();
		});
	});

	describe("handleCorsPreflightRequest", () => {
		test("should return null for non-OPTIONS requests", () => {
			const request = new Request("https://api.example.com/test", {
				method: "GET",
				headers: { origin: "https://client.com" },
			});

			const corsOptions: CorsOptions = {
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const response = handleCorsPreflightRequest(request, corsOptions);
			expect(response).toBeNull();
		});

		test("should return null when missing origin header", () => {
			const request = new Request("https://api.example.com/test", {
				method: "OPTIONS",
				// No origin header
			});

			const corsOptions: CorsOptions = {
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const response = handleCorsPreflightRequest(request, corsOptions);
			expect(response).toBeNull();
		});

		test("should return null when missing request method header", () => {
			const request = new Request("https://api.example.com/test", {
				method: "OPTIONS",
				headers: {
					origin: "https://client.com",
					// Missing access-control-request-method
				},
			});

			const corsOptions: CorsOptions = {
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const response = handleCorsPreflightRequest(request, corsOptions);
			expect(response).toBeNull();
		});

		test("should handle valid preflight request", () => {
			const request = new Request("https://api.example.com/test", {
				method: "OPTIONS",
				headers: {
					origin: "https://client.com",
					"access-control-request-method": "POST",
					"access-control-request-headers": "Content-Type, Authorization",
				},
			});

			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST", "PUT"],
				allowedHeaders: ["Content-Type", "Authorization"],
				credentials: true,
				optionsSuccessStatus: 200,
			};

			const response = handleCorsPreflightRequest(request, corsOptions);
			expect(response).not.toBeNull();

			if (response) {
				expect(response.status).toBe(200);

				const headers = Object.fromEntries(response.headers.entries());
				expect(headers["access-control-allow-origin"]).toBe(
					"https://client.com",
				);
				expect(headers["access-control-allow-methods"]).toBe("GET, POST, PUT");
				expect(headers["access-control-allow-headers"]).toBe(
					"Content-Type, Authorization",
				);
				expect(headers["access-control-allow-credentials"]).toBe("true");
			}
		});

		test("should reject disallowed method", () => {
			const request = new Request("https://api.example.com/test", {
				method: "OPTIONS",
				headers: {
					origin: "https://client.com",
					"access-control-request-method": "DELETE", // Not allowed
				},
			});

			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST"], // DELETE not included
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const response = handleCorsPreflightRequest(request, corsOptions);
			expect(response).not.toBeNull();
			if (response) {
				expect(response.status).toBe(405);
			}
		});

		test("should reject disallowed headers", () => {
			const request = new Request("https://api.example.com/test", {
				method: "OPTIONS",
				headers: {
					origin: "https://client.com",
					"access-control-request-method": "POST",
					"access-control-request-headers": "Content-Type, X-Custom-Header", // X-Custom-Header not allowed
				},
			});

			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"], // X-Custom-Header not included
				credentials: false,
			};

			const response = handleCorsPreflightRequest(request, corsOptions);
			expect(response).not.toBeNull();
			if (response) {
				expect(response.status).toBe(403);
			}
		});

		test("should use default status code when not specified", () => {
			const request = new Request("https://api.example.com/test", {
				method: "OPTIONS",
				headers: {
					origin: "https://client.com",
					"access-control-request-method": "GET",
				},
			});

			const corsOptions: CorsOptions = {
				origin: "*",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const response = handleCorsPreflightRequest(request, corsOptions);
			if (response) {
				expect(response.status).toBe(204); // Default status
			}
		});
	});

	describe("addCorsHeaders", () => {
		test("should add CORS headers to existing response", () => {
			const originalResponse = new Response("Hello World", {
				status: 200,
				headers: { "Content-Type": "text/plain" },
			});

			const request = new Request("https://api.example.com/test", {
				headers: { origin: "https://client.com" },
			});

			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: true,
				exposedHeaders: ["X-Total-Count"],
			};

			const corsResponse = addCorsHeaders(
				originalResponse,
				request,
				corsOptions,
			);

			// Original headers should be preserved
			expect(corsResponse.headers.get("Content-Type")).toBe("text/plain");

			// CORS headers should be added
			expect(corsResponse.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://client.com",
			);
			expect(corsResponse.headers.get("Access-Control-Allow-Credentials")).toBe(
				"true",
			);
			expect(corsResponse.headers.get("Access-Control-Expose-Headers")).toBe(
				"X-Total-Count",
			);

			// Response body and status should be preserved
			expect(corsResponse.status).toBe(200);
		});

		test("should not modify original response object", () => {
			const originalResponse = new Response("Hello World", {
				status: 200,
				headers: { "Content-Type": "text/plain" },
			});

			const request = new Request("https://api.example.com/test", {
				headers: { origin: "https://client.com" },
			});

			const corsOptions: CorsOptions = {
				origin: "https://client.com",
				methods: ["GET", "POST"],
				allowedHeaders: ["Content-Type"],
				credentials: false,
			};

			const corsResponse = addCorsHeaders(
				originalResponse,
				request,
				corsOptions,
			);

			// Original response should not have CORS headers
			expect(
				originalResponse.headers.get("Access-Control-Allow-Origin"),
			).toBeNull();

			// New response should have CORS headers
			expect(corsResponse.headers.get("Access-Control-Allow-Origin")).toBe(
				"https://client.com",
			);

			// They should be different objects
			expect(corsResponse).not.toBe(originalResponse);
		});
	});
});
