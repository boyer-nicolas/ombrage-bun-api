import { mock } from "bun:test";
import type { Config } from "./lib/config";

/**
 * Mock configuration factory for tests
 */
export function createMockConfig(overrides: Partial<Config> = {}): Config {
	return {
		server: {
			port: 3000,
			host: "localhost",
			logLevel: "info",
		},
		swagger: {
			enabled: true,
			path: "/",
		},
		title: "Test API",
		description: "Test API description",
		auth: {
			enabled: false,
			secret: "test-secret-key",
		},
		environment: "test",
		...overrides,
	} as Config;
}

/**
 * Mock request factory for tests
 */
export function createMockRequest(
	url: string,
	options: RequestInit = {},
): Request {
	return new Request(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
		...options,
	});
}

/**
 * Mock route handler for tests
 */
export function createMockRouteHandler(responseBody?: unknown) {
	return mock(async ({ request }: { request: Request }) => {
		if (responseBody) {
			return Response.json(responseBody);
		}
		return new Response("Mock response");
	});
}

/**
 * Mock route module for tests
 */
export function createMockRouteModule(methods: string[] = ["GET"]) {
	const routes: Record<string, unknown> = {};

	methods.forEach((method) => {
		routes[method] = {
			method,
			callback: createMockRouteHandler({ method, result: "success" }),
		};
	});

	return routes;
}

/**
 * Mock OpenAPI spec for tests
 */
export function createMockOpenAPISpec(path: string = "/test") {
	return {
		[path]: {
			get: {
				summary: "Test endpoint",
				description: "A test endpoint for unit tests",
				responses: {
					"200": {
						description: "Success response",
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
}

/**
 * Helper to create a mock file router
 */
export function createMockFileRouter() {
	return {
		discoverRoutes: mock(async () => {}),
		loadRoutes: mock(async () => {}),
		handleRequest: mock(async () => new Response("Mock router response")),
		handleSwaggerRequest: mock(() => null),
		getRoutes: mock(() => new Map()),
		getRouteInfo: mock(() => []),
		generateOpenAPISpec: mock(() => ({
			openapi: "3.1.0",
			info: { title: "Mock API", version: "1.0.0", description: "Mock API" },
			paths: {},
			servers: [],
		})),
		getSwaggerUIHTML: mock(() => "<html>Mock Swagger UI</html>"),
	};
}

/**
 * Helper to suppress console output during tests
 */
export function suppressConsole() {
	const originalLog = console.log;
	const originalError = console.error;
	const originalWarn = console.warn;
	const originalDebug = console.debug;

	console.log = mock(() => {});
	console.error = mock(() => {});
	console.warn = mock(() => {});
	console.debug = mock(() => {});

	return () => {
		console.log = originalLog;
		console.error = originalError;
		console.warn = originalWarn;
		console.debug = originalDebug;
	};
}

/**
 * Helper to create a temporary directory for testing
 */
export function createTempDir(prefix = "test-") {
	return `/tmp/${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Async helper to wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to create mock environment variables
 */
export function createMockEnv(envVars: Record<string, string> = {}) {
	const original = { ...process.env };

	// Clear relevant env vars
	Object.keys(process.env).forEach((key) => {
		if (
			key.startsWith("PORT") ||
			key.startsWith("HOST") ||
			key.startsWith("LOG_") ||
			key.startsWith("SWAGGER_") ||
			key.startsWith("AUTH_") ||
			key.startsWith("API_") ||
			key.startsWith("ENVIRONMENT")
		) {
			delete process.env[key];
		}
	});

	// Set new env vars
	Object.assign(process.env, envVars);

	return () => {
		process.env = original;
	};
}

/**
 * Test assertion helpers
 */
export const assertions = {
	/**
	 * Assert that a response has the expected status code
	 */
	async expectStatus(response: Response, expectedStatus: number) {
		if (response.status !== expectedStatus) {
			const body = await response.text();
			throw new Error(
				`Expected status ${expectedStatus}, got ${response.status}. Response body: ${body}`,
			);
		}
	},

	/**
	 * Assert that a response contains expected JSON
	 */
	async expectJson(response: Response, expectedJson: unknown) {
		const actualJson = await response.json();
		if (JSON.stringify(actualJson) !== JSON.stringify(expectedJson)) {
			throw new Error(
				`Expected JSON ${JSON.stringify(expectedJson)}, got ${JSON.stringify(actualJson)}`,
			);
		}
	},

	/**
	 * Assert that a string contains expected content
	 */
	expectContains(actual: string, expected: string) {
		if (!actual.includes(expected)) {
			throw new Error(`Expected "${actual}" to contain "${expected}"`);
		}
	},
};
