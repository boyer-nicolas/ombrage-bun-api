import Bun from "bun";
import { z } from "zod";

const booleanFromString = z
	.union([z.boolean(), z.string()])
	.transform((val) => {
		if (typeof val === "boolean") return val;
		if (typeof val === "string") {
			const lower = val.toLowerCase();
			if (lower === "true" || lower === "1" || lower === "yes") return true;
			if (lower === "false" || lower === "0" || lower === "no" || lower === "")
				return false;
			return Boolean(val);
		}
		return Boolean(val);
	});

// Custom number coercion from string
const numberFromString = z.union([z.number(), z.string()]).transform((val) => {
	if (typeof val === "number") return val;
	if (typeof val === "string") {
		const num = Number(val);
		if (Number.isNaN(num)) {
			return val; // Return original value to let Zod handle the error
		}
		return num;
	}
	return Number(val);
});

export const ConfigSchema = z.object({
	server: z
		.object({
			port: numberFromString.pipe(z.number().min(1).max(65535)).default(8080),
			host: z.string().default("0.0.0.0"),
			logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
		})
		.default({
			port: 8080,
			host: "0.0.0.0",
			logLevel: "info" as const,
		}),
	swagger: z
		.object({
			enabled: booleanFromString.default(true),
			path: z.string().default("/"),
		})
		.default({
			enabled: true,
			path: "/",
		}),
	title: z.string().default("My API"),
	description: z
		.string()
		.default("Auto-generated API documentation from route specifications"),
	auth: z
		.object({
			enabled: booleanFromString.default(false),
			secret: z.string().min(10).default("changeme"),
		})
		.default({
			enabled: false,
			secret: "changeme",
		}),
	environment: z
		.enum(["development", "production", "test"])
		.default("development"),
});

export type Config = z.infer<typeof ConfigSchema>;

// biome-ignore lint/complexity/noStaticOnlyClass: Exceptional for config
export class AppConfig {
	private static instance: Config;

	private static validateConfig(config: unknown): Config {
		const result = ConfigSchema.safeParse(config);
		if (!result.success) {
			console.error("Configuration validation error:", result.error.format());
			throw new Error("Invalid configuration");
		}
		return result.data;
	}

	static load(): void {
		const rawConfig: unknown = {
			...(Bun.env.PORT || Bun.env.HOST || Bun.env.LOG_LEVEL
				? {
						server: {
							...(Bun.env.PORT ? { port: Bun.env.PORT } : {}),
							...(Bun.env.HOST ? { host: Bun.env.HOST } : {}),
							...(Bun.env.LOG_LEVEL ? { logLevel: Bun.env.LOG_LEVEL } : {}),
						},
					}
				: {}),
			...(Bun.env.SWAGGER_ENABLED || Bun.env.SWAGGER_PATH
				? {
						swagger: {
							...(Bun.env.SWAGGER_ENABLED
								? { enabled: Bun.env.SWAGGER_ENABLED }
								: {}),
							...(Bun.env.SWAGGER_PATH ? { path: Bun.env.SWAGGER_PATH } : {}),
						},
					}
				: {}),
			...(Bun.env.AUTH_ENABLED || Bun.env.AUTH_SECRET
				? {
						auth: {
							...(Bun.env.AUTH_ENABLED
								? { enabled: Bun.env.AUTH_ENABLED }
								: {}),
							...(Bun.env.AUTH_SECRET ? { secret: Bun.env.AUTH_SECRET } : {}),
						},
					}
				: {}),
			...(Bun.env.API_TITLE ? { title: Bun.env.API_TITLE } : {}),
			...(Bun.env.API_DESCRIPTION
				? { description: Bun.env.API_DESCRIPTION }
				: {}),
			...(Bun.env.ENVIRONMENT ? { environment: Bun.env.ENVIRONMENT } : {}),
		};

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
