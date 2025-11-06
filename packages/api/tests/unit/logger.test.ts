import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getLogger } from "../../src/lib/logger";

describe("logger.ts", () => {
	let consoleWarnSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleInfoSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
		consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleWarnSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleLogSpy.mockRestore();
		consoleInfoSpy.mockRestore();
	});

	describe("Logger Functions", () => {
		test("should log warning messages", () => {
			const logger = getLogger();
			logger.warn("Test warning message");

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("[WARNING]"),
				"Test warning message",
			);
		});

		test("should log warning messages with warning alias", () => {
			const logger = getLogger();
			logger.warning("Test warning message");

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining("[WARNING]"),
				"Test warning message",
			);
		});

		test("should log error messages", () => {
			const logger = getLogger();
			logger.error("Test error message");

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[ERROR]"),
				"Test error message",
			);
		});

		test("should log trace messages", () => {
			const logger = getLogger();
			logger.trace("Test trace message");

			expect(consoleLogSpy).toHaveBeenCalledWith(
				expect.stringContaining("[TRACE]"),
				"Test trace message",
			);
		});

		test("should log fatal messages", () => {
			const logger = getLogger();
			logger.fatal("Test fatal message");

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[FATAL]"),
				"Test fatal message",
			);
		});

		test("should log HTTP request/response information", () => {
			const logger = getLogger();
			const request = new Request("http://localhost:3000/test", {
				method: "GET",
			});
			const response = new Response("OK", { status: 200 });
			const duration = 150;

			logger.http(request, response, duration);

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining("[HTTP]"),
				"GET http://localhost:3000/test => 200 (150ms)",
			);
		});

		test("should handle multiple arguments in log functions", () => {
			const logger = getLogger();
			logger.error("Error with context:", {
				code: 500,
				message: "Server error",
			});

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining("[ERROR]"),
				"Error with context:",
				{ code: 500, message: "Server error" },
			);
		});
	});
});
