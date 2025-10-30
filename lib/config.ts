import { z } from "zod";

export const ConfigSchema = z.object({
	server: z.object({
		port: z.number().min(1).max(65535).default(8080),
		host: z.string().default("0.0.0.0"),
		logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
	}),
	swagger: z.object({
		enabled: z.boolean().default(true),
		path: z.string().default("/"),
	}),
	title: z.string().default("My API"),
	description: z
		.string()
		.default("Auto-generated API documentation from route specifications"),
	auth: z.object({
		enabled: z.boolean().default(false),
		secret: z.string().min(10).default("changeme"),
	}),
	environment: z
		.enum(["development", "production", "test"])
		.default("development"),
});

export type Config = z.infer<typeof ConfigSchema>;

export enum AvailableEnvVars {
	PORT = "PORT",
	HOST = "HOST",
	LOG_LEVEL = "LOG_LEVEL",
	SWAGGER_ENABLED = "SWAGGER_ENABLED",
	SWAGGER_PATH = "SWAGGER_PATH",
	API_TITLE = "API_TITLE",
	API_DESCRIPTION = "API_DESCRIPTION",
	AUTH_ENABLED = "AUTH_ENABLED",
	AUTH_SECRET = "AUTH_SECRET",
	ENVIRONMENT = "ENVIRONMENT",
}

// biome-ignore lint/complexity/noStaticOnlyClass: Exceptional for config
export class AppConfig {
	private static instance: Config;

	private static validateConfig(config: Partial<Config>): Config {
		const result = ConfigSchema.safeParse(config);
		if (!result.success) {
			console.error("Configuration validation error:", result.error.format());
			throw new Error("Invalid configuration");
		}
		return result.data;
	}

	static get availableEnvironmentVariables(): string[] {
		return Object.values(AvailableEnvVars);
	}

	static getEnvVariable(name: AvailableEnvVars): string {
		const list = Object.values(AvailableEnvVars);
		if (list.includes(name)) {
			return process.env[name] || "";
		}
		return "";
	}

	static load(): void {
		// Helper to get environment variable only if it exists and is not empty
		const getEnvIfDefined = (envVar: AvailableEnvVars) => {
			const value = process.env[envVar];
			return value && value.trim() !== "" ? value : undefined;
		};

		// Create raw config object with base structure for Zod defaults
		// biome-ignore lint/suspicious/noExplicitAny: Exceptional for config parsing
		const rawConfig: any = {
			server: {},
			swagger: {},
			auth: {},
		};

		// Server configuration
		const port = getEnvIfDefined(AvailableEnvVars.PORT);
		const host = getEnvIfDefined(AvailableEnvVars.HOST);
		const logLevel = getEnvIfDefined(AvailableEnvVars.LOG_LEVEL);

		if (port && !Number.isNaN(Number.parseInt(port, 10)))
			rawConfig.server.port = Number.parseInt(port, 10);
		if (host) rawConfig.server.host = host;
		if (logLevel) rawConfig.server.logLevel = logLevel;

		// Swagger configuration
		const swaggerEnabled = getEnvIfDefined(AvailableEnvVars.SWAGGER_ENABLED);
		const swaggerPath = getEnvIfDefined(AvailableEnvVars.SWAGGER_PATH);

		if (swaggerEnabled)
			rawConfig.swagger.enabled = swaggerEnabled.toLowerCase() === "true";
		if (swaggerPath) rawConfig.swagger.path = swaggerPath;

		// API metadata
		const apiTitle = getEnvIfDefined(AvailableEnvVars.API_TITLE);
		if (apiTitle) rawConfig.title = apiTitle;

		const apiDescription = getEnvIfDefined(AvailableEnvVars.API_DESCRIPTION);
		if (apiDescription) rawConfig.description = apiDescription;

		// Auth configuration
		const authEnabled = getEnvIfDefined(AvailableEnvVars.AUTH_ENABLED);
		const authSecret = getEnvIfDefined(AvailableEnvVars.AUTH_SECRET);

		if (authEnabled)
			rawConfig.auth.enabled = authEnabled.toLowerCase() === "true";
		if (authSecret) rawConfig.auth.secret = authSecret;

		// Environment
		const environment = getEnvIfDefined(AvailableEnvVars.ENVIRONMENT);
		if (environment) rawConfig.environment = environment;

		// Let Zod parse and apply defaults for any missing values
		AppConfig.instance = AppConfig.validateConfig(rawConfig);
	}

	static get(): Config {
		if (!AppConfig.instance) {
			throw new Error("Config not loaded. Call AppConfig.load() first.");
		}
		return AppConfig.instance;
	}
}

// Load configuration at module initialization
AppConfig.load();
