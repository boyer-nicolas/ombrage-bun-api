import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AppConfig, type Config, ConfigSchema } from "../../src/lib/config";

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

		// Clear process.env properties individually (can't reassign the object)
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
					routesDir: "./routes",
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
						routesDir: "./routes",
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
					routesDir: "./routes",
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
			(process.env as Record<string, string | undefined>).PORT = "3000";
			(process.env as Record<string, string | undefined>).HOST = "localhost";
			(process.env as Record<string, string | undefined>).LOG_LEVEL = "debug";
			(process.env as Record<string, string | undefined>).SWAGGER_ENABLED =
				"false";
			(process.env as Record<string, string | undefined>).SWAGGER_PATH =
				"/api-docs";
			(process.env as Record<string, string | undefined>).AUTH_ENABLED = "true";
			(process.env as Record<string, string | undefined>).AUTH_SECRET =
				"super-secret-key";
			(process.env as Record<string, string | undefined>).API_TITLE =
				"Custom API";
			(process.env as Record<string, string | undefined>).API_DESCRIPTION =
				"Custom API description";
			(process.env as Record<string, string | undefined>).ENVIRONMENT =
				"production";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config).toEqual({
				server: {
					port: 3000,
					host: "localhost",
					logLevel: "debug",
					routesDir: "./routes",
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
			(process.env as Record<string, string | undefined>).PORT = "invalid";

			expect(() => AppConfig.load()).toThrow("Invalid configuration");
		});

		test("should handle partial environment variables with defaults", () => {
			(process.env as Record<string, string>).PORT = "4000";
			(process.env as Record<string, string>).API_TITLE = "Partial Config API";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config.server.port).toBe(4000);
			expect(config.title).toBe("Partial Config API");
			expect(config.server.host).toBe("0.0.0.0"); // default
			expect(config.server.logLevel).toBe("info"); // default
		});

		test("should handle boolean environment variables correctly", () => {
			(process.env as Record<string, string>).SWAGGER_ENABLED = "true";
			(process.env as Record<string, string>).AUTH_ENABLED = "false";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config.swagger.enabled).toBe(true);
			expect(config.auth.enabled).toBe(false);
		});

		test('should handle string "false" as boolean false', () => {
			(process.env as Record<string, string>).SWAGGER_ENABLED = "false";
			(process.env as Record<string, string>).AUTH_ENABLED = "false";

			AppConfig.load();
			const config = AppConfig.get();

			expect(config.swagger.enabled).toBe(false);
			expect(config.auth.enabled).toBe(false);
		});

		test("should reload config when load() is called multiple times", () => {
			// First load
			(process.env as Record<string, string>).PORT = "3000";
			(process.env as Record<string, string>).SWAGGER_ENABLED = "true";
			AppConfig.load();
			const config1 = AppConfig.get();

			// Change env and reload
			(process.env as Record<string, string>).PORT = "5000";
			(process.env as Record<string, string>).SWAGGER_ENABLED = "false";
			AppConfig.load();
			const config2 = AppConfig.get();

			// Verify the configs are different
			expect(config1.server.port).toBe(3000);
			expect(config1.swagger.enabled).toBe(true);
			expect(config2.server.port).toBe(5000);
			expect(config2.swagger.enabled).toBe(false);
		});
	});
});
