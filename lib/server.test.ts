import { beforeEach, describe, expect, mock, test } from "bun:test";
import { AppConfig } from "./config";
import { Server } from "./server";

describe("server.ts", () => {
	let server: Server;

	beforeEach(() => {
		// Load AppConfig with defaults before creating server instances
		AppConfig.load();
		server = new Server();
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
			Server.server = { stop: mockStop } as any;

			const originalLog = console.log;
			const originalExit = process.exit;

			console.log = mock(() => {});
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

			Bun.serve = mock(() => mockServer) as any;
			console.log = mock(() => {});

			await server.start();

			expect(Bun.serve).toHaveBeenCalled();
			expect(console.log).toHaveBeenCalledWith(
				"==> Server running at http://localhost:3000",
			);

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

	describe("Server static properties", () => {
		test("should have server property for storing server instance", () => {
			expect(Server.server).toBeUndefined();
		});
	});
});
