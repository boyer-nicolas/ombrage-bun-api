import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AppConfig, type Config, ConfigSchema } from "../config";

describe("config.ts", () => {
	// Store original environment variables
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Reset AppConfig instance between tests
		// @ts-expect-error - Accessing private property for testing
		AppConfig.instance = null;

		// Reset environment variables with defaults
		Object.keys(process.env).forEach((key) => {
			if (
				key.startsWith("APP_") ||
				[
					"PORT",
					"HOST",
					"LOG_LEVEL",
					"SWAGGER_ENABLED",
					"SWAGGER_PATH",
					"AUTH_ENABLED",
					"AUTH_SECRET",
					"API_TITLE",
					"API_DESCRIPTION",
					"ENVIRONMENT",
				].includes(key)
			) {
				delete process.env[key];
			}
		});

		// Clear Bun.env properties individually (can't reassign the object)
		Object.keys(Bun.env).forEach((key) => {
			if (
				key.startsWith("APP_") ||
				[
					"PORT",
					"HOST",
					"LOG_LEVEL",
					"SWAGGER_ENABLED",
					"SWAGGER_PATH",
					"AUTH_ENABLED",
					"AUTH_SECRET",
					"API_TITLE",
					"API_DESCRIPTION",
					"ENVIRONMENT",
				].includes(key)
			) {
				delete Bun.env[key];
			}
		});
	});

	afterEach(() => {
		// Restore original environment variables
		process.env = { ...originalEnv };
	});

	describe("ConfigSchema", () => {
		test("should validate valid config", () => {
			const validConfig: Config = {
				server: {
					port: 3000,
					host: "localhost",
					logLevel: "info",
				},
				swagger: {
					enabled: true,
					path: "/docs",
				},
				title: "Test API",
				description: "Test API description",
				auth: {
					enabled: false,
					secret: "test-secret",
				},
				environment: "development",
			};

			const result = ConfigSchema.safeParse(validConfig);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual(validConfig);
			}
		});

		test("should apply default values for missing properties", () => {
			const minimalConfig = {};

			const result = ConfigSchema.safeParse(minimalConfig);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({
					server: {
						port: 8080,
						host: "0.0.0.0",
						logLevel: "info",
					},
					swagger: {
						enabled: true,
						path: "/",
					},
					title: "My API",
					description:
						"Auto-generated API documentation from route specifications",
					auth: {
						enabled: false,
						secret: "changeme",
					},
					environment: "development",
				});
			}
		});

		test("should reject invalid port numbers", () => {
			const invalidConfigs = [
				{ server: { port: 0 } },
				{ server: { port: -1 } },
				{ server: { port: 65536 } },
				{ server: { port: "invalid" } },
			];

			invalidConfigs.forEach((config) => {
				const result = ConfigSchema.safeParse(config);
				expect(result.success).toBe(false);
			});
		});

		test("should reject invalid log levels", () => {
			const invalidConfig = {
				server: { logLevel: "invalid" },
			};

			const result = ConfigSchema.safeParse(invalidConfig);
			expect(result.success).toBe(false);
		});

		test("should reject short auth secrets", () => {
			const invalidConfig = {
				auth: { secret: "short" },
			};

			const result = ConfigSchema.safeParse(invalidConfig);
			expect(result.success).toBe(false);
		});

		test("should reject invalid environments", () => {
			const invalidConfig = {
				environment: "invalid",
			};

			const result = ConfigSchema.safeParse(invalidConfig);
			expect(result.success).toBe(false);
		});
	});

	describe("AppConfig", () => {
		test("should load config with default values when no environment variables are set", () => {
			AppConfig.load();
			const config = AppConfig.get();

			expect(config).toEqual({
				server: {
					port: 8080,
					host: "0.0.0.0",
					logLevel: "info",
				},
				swagger: {
					enabled: true,
					path: "/",
				},
				title: "My API",
				description:
					"Auto-generated API documentation from route specifications",
				auth: {
					enabled: false,
					secret: "changeme",
				},
				environment: "development",
			});
		});

		test("should load config from environment variables", () => {
			Bun.env.PORT = "3000";
			Bun.env.HOST = "localhost";
			Bun.env.LOG_LEVEL = "debug";
			Bun.env.SWAGGER_ENABLED = "false";
			Bun.env.SWAGGER_PATH = "/api-docs";
			Bun.env.AUTH_ENABLED = "true";
			Bun.env.AUTH_SECRET = "super-secret-key";
			Bun.env.API_TITLE = "Custom API";
			Bun.env.API_DESCRIPTION = "Custom API description";
			Bun.env.ENVIRONMENT = "production";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config).toEqual({
				server: {
					port: 3000,
					host: "localhost",
					logLevel: "debug",
				},
				swagger: {
					enabled: false,
					path: "/api-docs",
				},
				auth: {
					enabled: true,
					secret: "super-secret-key",
				},
				title: "Custom API",
				description: "Custom API description",
				environment: "production",
			});
		});

		test("should throw error when getting config before loading", () => {
			expect(() => AppConfig.get()).toThrow(
				"Config not loaded. Call AppConfig.load() first.",
			);
		});

		test("should throw error for invalid configuration", () => {
			Bun.env.PORT = "invalid";

			expect(() => AppConfig.load()).toThrow("Invalid configuration");
		});

		test("should handle partial environment variables with defaults", () => {
			Bun.env.PORT = "4000";
			Bun.env.API_TITLE = "Partial Config API";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config.server.port).toBe(4000);
			expect(config.title).toBe("Partial Config API");
			expect(config.server.host).toBe("0.0.0.0"); // default
			expect(config.server.logLevel).toBe("info"); // default
		});

		test("should handle boolean environment variables correctly", () => {
			Bun.env.SWAGGER_ENABLED = "true";
			Bun.env.AUTH_ENABLED = "false";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config.swagger.enabled).toBe(true);
			expect(config.auth.enabled).toBe(false);
		});

		test("should handle string 'false' as boolean false", () => {
			Bun.env.SWAGGER_ENABLED = "false";
			Bun.env.AUTH_ENABLED = "false";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config.swagger.enabled).toBe(false);
			expect(config.auth.enabled).toBe(false);
		});

		test("should reload config when load() is called multiple times", () => {
			AppConfig.load();
			const firstConfig = AppConfig.get();

			Bun.env.PORT = "5000";
			AppConfig.load();
			const secondConfig = AppConfig.get();

			expect(firstConfig.server.port).toBe(8080);
			expect(secondConfig.server.port).toBe(5000);
		});
	});
});
