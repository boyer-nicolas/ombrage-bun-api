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

// Define proxy handler function type
export type ProxyHandler = (props: {
	request: Request;
	params: Record<string, string>;
	target?: string;
}) => Promise<{
	proceed: boolean;
	skip?: boolean;
	response?: Response;
	headers?: Record<string, string>;
	target?: string;
}>;

// Proxy configuration schema
const ProxyConfigSchema = z.object({
	pattern: z
		.string()
		.describe(
			"Wildcard pattern to match routes (e.g., '/api/*', '/auth/*/protected')",
		),
	target: z.url().optional().describe("Target URL to proxy requests to"),
	enabled: z.boolean().default(true),
	basePath: z
		.string()
		.default("/")
		.describe("Base path for proxy pattern matching"),
	description: z
		.string()
		.optional()
		.describe("Optional description of what this proxy does"),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("Additional headers to add to proxied requests"),
	timeout: numberFromString
		.pipe(z.number().min(1000).max(60000))
		.default(10000)
		.optional()
		.describe("Request timeout in milliseconds"),
	retries: numberFromString
		.pipe(z.number().min(0).max(5))
		.default(0)
		.optional()
		.describe("Number of retry attempts on failure"),
	logging: z
		.boolean()
		.default(true)
		.optional()
		.describe("Enable or disable logging for this proxy (default: true)"),
});

export type ProxyConfig = z.infer<typeof ProxyConfigSchema> & {
	handler?: ProxyHandler;
};

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
	proxy: z
		.object({
			enabled: booleanFromString.default(false),
			configs: z.array(ProxyConfigSchema).default([]),
		})
		.default({ enabled: false, configs: [] }),
	cors: z
		.object({
			enabled: booleanFromString.default(false),
			origin: z
				.union([
					z.string().describe("Single origin URL"),
					z.array(z.string()).describe("Array of allowed origins"),
					z.boolean().describe("true for * (all origins), false to disable"),
				])
				.default("*")
				.describe("Allowed origins for CORS requests"),
			methods: z
				.array(
					z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]),
				)
				.default(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
				.describe("Allowed HTTP methods for CORS requests"),
			allowedHeaders: z
				.array(z.string())
				.default(["Content-Type", "Authorization"])
				.describe("Allowed headers for CORS requests"),
			exposedHeaders: z
				.array(z.string())
				.optional()
				.describe("Headers exposed to the client"),
			credentials: booleanFromString
				.default(false)
				.describe("Allow credentials in CORS requests"),
			maxAge: numberFromString
				.pipe(z.number().min(0).max(86400))
				.default(3600)
				.optional()
				.describe("Preflight cache duration in seconds (max 24h)"),
			optionsSuccessStatus: numberFromString
				.pipe(z.number().min(200).max(299))
				.default(204)
				.optional()
				.describe("Status code for successful OPTIONS requests"),
		})
		.default({
			enabled: false,
			origin: "*",
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: false,
			maxAge: 3600,
			optionsSuccessStatus: 204,
		}),
	swagger: z
		.object({
			enabled: booleanFromString.default(true),
			path: z.string("Please provide a valid Swagger UI path").default("/"),
			externalSpecs: z
				.array(
					z.object({
						url: z
							.string()
							.url()
							.describe("URL to fetch the external OpenAPI spec"),
						name: z.string().describe("Identifier for the external spec"),
						tags: z
							.array(z.string())
							.optional()
							.describe("Tags to group external operations under"),
						pathPrefix: z
							.string()
							.optional()
							.describe(
								"Path prefix to prepend to all paths from the external spec (e.g., '/api' will transform '/users' to '/api/users')",
							),
					}),
				)
				.optional()
				.describe(
					"External OpenAPI specs to merge with generated documentation",
				),
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

export type Config = z.infer<typeof ConfigSchema> & {
	proxy?: {
		enabled: boolean;
		configs: ProxyConfig[];
	};
	cors?: {
		enabled: boolean;
		origin: string | string[] | boolean;
		methods: string[];
		allowedHeaders: string[];
		exposedHeaders?: string[];
		credentials: boolean;
		maxAge?: number;
		optionsSuccessStatus?: number;
	};
};

// Input type for partial configuration
export type ConfigInput = z.input<typeof ConfigSchema> & {
	proxy?: {
		enabled?: boolean;
		configs?: Partial<ProxyConfig>[];
	};
	cors?: {
		enabled?: boolean;
		origin?: string | string[] | boolean;
		methods?: string[];
		allowedHeaders?: string[];
		exposedHeaders?: string[];
		credentials?: boolean;
		maxAge?: number;
		optionsSuccessStatus?: number;
	};
};

export function validateConfig(config: unknown): Config {
	// Extract proxy configs with handlers before validation
	const configWithoutHandlers = JSON.parse(JSON.stringify(config));
	const proxyHandlers: Map<number, ProxyHandler> = new Map();

	if (configWithoutHandlers.proxy?.configs) {
		configWithoutHandlers.proxy.configs =
			configWithoutHandlers.proxy.configs.map(
				// biome-ignore lint/suspicious/noExplicitAny: This is necessary to handle unknown config shapes
				(proxyConfig: any, index: number) => {
					// Check original config for handlers since they won't survive JSON serialization
					// biome-ignore lint/suspicious/noExplicitAny: This is necessary to handle unknown config shapes
					const originalConfig = (config as any)?.proxy?.configs?.[index];
					if (originalConfig?.handler) {
						proxyHandlers.set(index, originalConfig.handler);
					}
					// Remove handler for Zod validation (it won't be in the serialized copy anyway)
					// biome-ignore lint/correctness/noUnusedVariables: This is to exclude handler from the returned object
					const { handler, ...configWithoutHandler } =
						originalConfig || proxyConfig;
					return configWithoutHandler;
				},
			);
	}

	const result = ConfigSchema.safeParse(configWithoutHandlers);
	if (!result.success) {
		console.error("Configuration validation error:", result.error);
		console.error("Provided configuration:", config);
		throw new Error("Invalid configuration");
	}

	// Re-add handlers to the validated config
	const validatedConfig = result.data as Config;
	if (validatedConfig.proxy?.configs && proxyHandlers.size > 0) {
		validatedConfig.proxy.configs = validatedConfig.proxy.configs.map(
			(proxyConfig, index) => {
				const handler = proxyHandlers.get(index);
				return handler ? { ...proxyConfig, handler } : proxyConfig;
			},
		);
	}

	configInstance = validatedConfig;
	return validatedConfig;
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
