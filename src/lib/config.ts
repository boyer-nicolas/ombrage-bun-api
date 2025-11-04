import { z } from "zod";

let configInstance: Config | null = null;

const booleanFromString = z
	.union([z.boolean("Please provide a valid boolean"), z.string()])
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
			port: numberFromString
				.pipe(z.number("Please provide a valid port number").min(0).max(65535))
				.default(8080),
			host: z.string("Please provide a valid host").default("0.0.0.0"),
			logLevel: z
				.enum(
					["debug", "info", "warning", "error", "trace", "fatal"],
					"Please provide a valid log level",
				)
				.default("info"),
			routes: z
				.object({
					dir: z
						.string("Please provide a valid routes directory")
						.default("./routes"),
					basePath: z.string("Please provide a valid base path").default("/"),
				})
				.default({ dir: "./routes", basePath: "/" }),
			static: z
				.object({
					dir: z
						.string("Please provide a valid static files directory")
						.default("./static"),
					enabled: booleanFromString.default(false),
					basePath: z
						.string("Please provide a valid static files base path")
						.default("/static"),
				})
				.default({ dir: "./static", enabled: false, basePath: "/static" }),
		})
		.default({
			port: 8080,
			host: "0.0.0.0",
			logLevel: "info",
			routes: { dir: "./routes", basePath: "/" },
			static: { dir: "./static", enabled: false, basePath: "/static" },
		}),
	swagger: z
		.object({
			enabled: booleanFromString.default(true),
			path: z.string("Please provide a valid Swagger UI path").default("/"),
		})
		.default({ enabled: true, path: "/" }),
	title: z.string("Please provide a valid API title").default("My API"),
	description: z
		.string("Please provide a valid API description")
		.default("Auto-generated API documentation from route specifications"),
	environment: z
		.enum(
			["development", "production", "test"],
			"Please provide a valid environment",
		)
		.default("development"),
});

export type Config = z.infer<typeof ConfigSchema>;

// Input type for partial configuration
export type ConfigInput = z.input<typeof ConfigSchema>;

export function validateConfig(config: unknown): Config {
	const result = ConfigSchema.safeParse(config);
	if (!result.success) {
		console.error("Configuration validation error:", result.error);
		console.error("Provided configuration:", config);
		throw new Error("Invalid configuration");
	}

	configInstance = result.data;
	return result.data;
}

export function getConfig(): Config {
	if (!configInstance) {
		throw new Error("Configuration has not been loaded yet.");
	}
	return configInstance;
}

// For testing purposes - reset the global config instance
export function resetConfig(): void {
	configInstance = null;
}
