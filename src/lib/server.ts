import { AppConfig, type Config } from "./config";
import { FileRouter } from "./router";

export type OmbrageServer = Bun.Server<undefined>;

// Helper type for deep partial configuration
type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export class Server {
	public config: Config;
	public fileRouter: FileRouter;
	static instance?: OmbrageServer;

	constructor(config: DeepPartial<Config>) {
		this.config = AppConfig.get();
		if (config) {
			this.config = this.mergeConfig(this.config, config);
		}
		this.fileRouter = new FileRouter(this.config);
	}

	private mergeConfig(
		defaultConfig: Config,
		partialConfig: DeepPartial<Config>,
	): Config {
		const merged = { ...defaultConfig };

		if (partialConfig.server) {
			merged.server = { ...merged.server, ...partialConfig.server };
		}

		if (partialConfig.swagger) {
			merged.swagger = { ...merged.swagger, ...partialConfig.swagger };
		}

		if (partialConfig.auth) {
			merged.auth = { ...merged.auth, ...partialConfig.auth };
		}

		if (partialConfig.title !== undefined) {
			merged.title = partialConfig.title;
		}

		if (partialConfig.description !== undefined) {
			merged.description = partialConfig.description;
		}

		if (partialConfig.environment !== undefined) {
			merged.environment = partialConfig.environment;
		}

		return merged;
	}

	async init(): Promise<Bun.Serve.Options<undefined, string>> {
		// Discover and load all routes
		await this.fileRouter.discoverRoutes();
		await this.fileRouter.loadRoutes();

		// Log discovered routes for debugging
		if (this.config.server.logLevel === "debug") {
			console.debug("Discovered routes:");
			console.debug(this.fileRouter.getRouteInfo());

			console.log("Configuration:", this.config);
		}

		const self = this;
		return {
			port: this.config.server.port,
			hostname: this.config.server.host,
			async fetch(request) {
				const startTime = Date.now();
				const url = new URL(request.url);

				// Health check endpoint
				if (url.pathname === "/healthz") {
					return new Response("OK");
				}

				// Check for Swagger UI routes
				const swaggerResponse = self.fileRouter.handleSwaggerRequest(
					url.pathname,
				);
				if (swaggerResponse) {
					return swaggerResponse;
				}

				// Use file-based router for all other requests
				const response = await self.fileRouter.handleRequest(request);
				if (response.status === 404) {
					console.log(
						`==> ${Bun.color("red", "ansi")}${request.method}  ${url.pathname} ${Bun.color("white", "ansi")} - ${
							Date.now() - startTime
						}ms (status: ${Bun.color("red", "ansi")} ${response.status} ${Bun.color("white", "ansi")})`,
					);
					return response;
				}

				if (response.status >= 400) {
					console.log(
						`==> ${Bun.color("yellow", "ansi")}${request.method} ${Bun.color(
							"cyan",
							"ansi",
						)} ${url.pathname} ${Bun.color("white", "ansi")} - ${
							Date.now() - startTime
						}ms (status: ${Bun.color("yellow", "ansi")} ${response.status} ${Bun.color("white", "ansi")})`,
					);
					return response;
				}

				console.log(
					`==> ${Bun.color("green", "ansi")}${request.method} ${Bun.color("cyan", "ansi")} ${url.pathname} ${Bun.color("white", "ansi")} - ${Date.now() - startTime}ms (status: ${response.status})`,
				);
				return response;
			},
		};
	}

	async start(): Promise<OmbrageServer> {
		console.log("==> Starting server...");
		const serverOptions = await this.init();
		const server = Bun.serve(serverOptions);
		console.log(`==> Server running at ${server.url}`);
		return server;
	}

	static stop() {
		console.log("==> Stopping server...");
		console.log("==> Shutting down gracefully...");
		try {
			Server.instance?.stop();
		} catch (error) {
			console.error("Error stopping server:", error);
		} finally {
			console.log("==> Server stopped.");
			process.exit();
		}
	}
}

process.on("SIGINT", () => {
	Server.stop();
});
process.on("SIGTERM", () => {
	Server.stop();
});
