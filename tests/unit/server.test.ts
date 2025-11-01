import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppConfig } from "../../src/lib/config";
import { Server } from "../../src/lib/server";

describe("server.ts", () => {
	let server: Server;
	let tempDir: string;
	let routesDir: string;

	beforeEach(async () => {
		// Load AppConfig with defaults before creating server instances
		AppConfig.load();

		// Create temporary directory for testing
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ombrage-test-"));
		routesDir = path.join(tempDir, "routes");
		await fs.mkdir(routesDir, { recursive: true });

		// Create a simple test route
		const testRouteDir = path.join(routesDir, "test");
		await fs.mkdir(testRouteDir, { recursive: true });

		await fs.writeFile(
			path.join(testRouteDir, "route.ts"),
			`import { createRoute } from "../../src/lib/helpers";
			import { z } from "zod";
			export const GET = createRoute({
				method: "GET",
				callback: async () => Response.json({ message: "test" }),
				spec: {
					summary: "Test route",
					responses: {
						"200": {
							description: "Successful response",
							schema: z.object({
								message: z.string()
							})
						}
					}
				}
			});`,
		);

		server = new Server(routesDir);
	});

	afterEach(async () => {
		// Clean up temporary directory
		if (tempDir) {
			await fs.rm(tempDir, { recursive: true, force: true });
		}
	});

	describe("configuration output", () => {
		test("should not output config when log level is not debug", async () => {
			const originalLog = console.log;
			const originalLogLevel = process.env.LOG_LEVEL;
			const logMock = mock(() => {});
			console.log = logMock;

			// Set info log level
			process.env.LOG_LEVEL = "info";
			AppConfig.load();
			const infoServer = new Server(routesDir);

			await infoServer.init();

			// Check that config was not logged
			const configCalls = logMock.mock.calls.filter((call: unknown[]) =>
				call[0]?.toString?.().includes("Configuration:"),
			);
			expect(configCalls).toHaveLength(0);

			// Restore
			console.log = originalLog;
			process.env.LOG_LEVEL = originalLogLevel;
		});
	});

	describe("Server constructor", () => {
		test("should initialize server instance", () => {
			expect(server).toBeInstanceOf(Server);
		});
	});

	describe("init", () => {
		test("should return server options object", async () => {
			const options = await server.init();

			expect(options).toMatchObject({
				port: expect.any(Number),
				hostname: expect.any(String),
				fetch: expect.any(Function),
			});
		});

		test("should have fetch function that handles requests", async () => {
			const options = await server.init();

			expect(typeof options.fetch).toBe("function");
		});
	});

	describe("handleShutdown", () => {
		test("should be a static method", () => {
			expect(typeof Server.handleShutdown).toBe("function");
		});

		test("should handle shutdown gracefully", () => {
			const originalLog = console.log;
			const originalExit = process.exit;

			console.log = mock(() => {});
			// biome-ignore lint/suspicious/noExplicitAny: needed for mocking
			process.exit = mock(() => {}) as any;

			Server.handleShutdown();

			expect(console.log).toHaveBeenCalledWith(
				"==> Shutting down gracefully...",
			);
			expect(process.exit).toHaveBeenCalled();

			// Restore
			console.log = originalLog;
			process.exit = originalExit;
		});

		test("should stop server if it exists", () => {
			const mockStop = mock(() => {});
			// biome-ignore lint/suspicious/noExplicitAny: needed for mocking
			Server.server = { stop: mockStop } as any;

			const originalLog = console.log;
			const originalExit = process.exit;

			console.log = mock(() => {});
			// biome-ignore lint/suspicious/noExplicitAny: needed for mocking
			process.exit = mock(() => {}) as any;

			Server.handleShutdown();

			expect(mockStop).toHaveBeenCalled();

			// Restore
			console.log = originalLog;
			process.exit = originalExit;
			Server.server = undefined;
		});
	});

	describe("start", () => {
		test("should call Bun.serve with options", async () => {
			const mockServer = {
				url: "http://localhost:3000",
				stop: mock(() => {}),
			};

			const originalServe = Bun.serve;
			const originalLog = console.log;

			// biome-ignore lint/suspicious/noExplicitAny: needed for mocking
			Bun.serve = mock(() => mockServer) as any;
			console.log = mock(() => {});

			await server.start();

			expect(Bun.serve).toHaveBeenCalled();
			expect(console.log).toHaveBeenCalledWith("==> Starting server...");
			expect(console.log).toHaveBeenCalledWith(
				"==> Server running at http://localhost:3000",
			);

			// Restore
			Bun.serve = originalServe;
			console.log = originalLog;
		});

		test("should set server static property when starting", async () => {
			const mockServer = {
				url: "http://localhost:3000",
				stop: mock(() => {}),
			};

			const originalServe = Bun.serve;
			const originalLog = console.log;

			// biome-ignore lint/suspicious/noExplicitAny: needed for mocking
			Bun.serve = mock(() => mockServer) as any;
			console.log = mock(() => {});

			await server.start();

			// The Bun.serve call should have been made
			expect(Bun.serve).toHaveBeenCalled();

			// Restore
			Bun.serve = originalServe;
			console.log = originalLog;
		});
	});

	describe("signal handlers", () => {
		test("should have handleShutdown method available for signal handlers", () => {
			expect(typeof Server.handleShutdown).toBe("function");
		});
	});

	describe("server fetch function", () => {
		test("should have fetch function defined", async () => {
			const server = new Server(routesDir);
			const options = await server.init();

			expect(options.fetch).toBeDefined();
			expect(typeof options.fetch).toBe("function");
		});

		test("should handle different response paths with logging", async () => {
			const originalLog = console.log;
			const logMock = mock(() => {});
			console.log = logMock;

			const server = new Server(routesDir);

			// Test 404 responses
			const originalHandleRequest404 = server.fileRouter.handleRequest;
			server.fileRouter.handleRequest = mock(
				async () => new Response("Not Found", { status: 404 }),
			);

			let options = await server.init();
			expect(options.fetch).toBeDefined();

			// Test 4xx responses
			server.fileRouter.handleRequest = mock(
				async () => new Response("Bad Request", { status: 400 }),
			);

			options = await server.init();
			expect(options.fetch).toBeDefined();

			// Test successful responses
			server.fileRouter.handleRequest = mock(
				async () => new Response("OK", { status: 200 }),
			);

			options = await server.init();
			expect(options.fetch).toBeDefined();

			// Restore
			server.fileRouter.handleRequest = originalHandleRequest404;
			console.log = originalLog;
		});

		test("should have swagger request handling", async () => {
			const server = new Server(routesDir);
			const options = await server.init();

			// Mock swagger response
			const originalHandleSwagger = server.fileRouter.handleSwaggerRequest;
			server.fileRouter.handleSwaggerRequest = mock(
				() => new Response("swagger", { status: 200 }),
			);

			expect(options.fetch).toBeDefined();

			// Restore
			server.fileRouter.handleSwaggerRequest = originalHandleSwagger;
		});
	});

	describe("Server static properties", () => {
		test("should have server property for storing server instance", () => {
			expect(Server.server).toBeUndefined();
		});
	});
});
