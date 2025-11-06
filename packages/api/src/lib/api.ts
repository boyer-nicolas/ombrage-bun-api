import { type Config, type ConfigInput, validateConfig } from "./config";
import { getLogger, type Logger } from "./logger";
import { FileRouter } from "./router";

export type OmbrageServer = Bun.Server<undefined>;

export class Api {
	public config: Config;
	public fileRouter: FileRouter;
	static instance?: OmbrageServer;
	private logger: Logger;

	constructor(config: ConfigInput) {
		this.config = validateConfig(config);
		this.fileRouter = new FileRouter(this.config);
		this.logger = getLogger(this.config.server.logLevel);
	}

	async init(): Promise<Bun.Serve.Options<undefined, string>> {
		// Discover and load all routes
		await this.fileRouter.discoverRoutes();
		await this.fileRouter.loadRoutes();

		// Log discovered routes for debugging
		this.logger.debug(this.config, "Configuration");
		this.logger.debug(this.fileRouter.getRouteInfo(), "Discovered routes:");

		// Log proxy configurations if enabled
		if (this.config.proxy?.enabled && this.config.proxy.configs.length > 0) {
			const proxyInfo = this.config.proxy.configs
				.filter((config) => config.enabled)
				.map(
					(config) =>
						`${config.pattern} -> ${config.target}${config.description ? ` (${config.description})` : ""}`,
				);
			this.logger.debug(proxyInfo, "Enabled proxy configurations:");
		}

		const self = this;
		return {
			port: this.config.server.port,
			hostname: this.config.server.host,
			async fetch(request) {
				const startTime = Date.now();
				const url = new URL(request.url);

				// Check for Swagger UI routes
				const swaggerResponse = await self.fileRouter.handleSwaggerRequest(
					url.pathname,
				);
				if (swaggerResponse) {
					return swaggerResponse;
				}

				if (url.pathname === "/favicon.ico") {
					// Bypass logging for favicon requests
					return new Response(null, { status: 204 });
				}

				// Handle proxy requests first (before static files and routes)
				if (self.config.proxy?.enabled) {
					const proxyResponse =
						await self.fileRouter.handleProxyRequest(request);
					if (proxyResponse) {
						self.logger.http(request, proxyResponse, Date.now() - startTime);
						return proxyResponse;
					}
				}

				// Handle static file requests
				if (
					self.config.server.static?.enabled &&
					self.config.server.static.dir &&
					self.config.server.static.basePath &&
					url.pathname.startsWith(self.config.server.static.basePath)
				) {
					// Check for static file requests
					const staticResponse = await self.fileRouter.handleStaticRequest(
						url.pathname.replace(self.config.server.static.basePath, ""),
					);
					self.logger.http(request, staticResponse, Date.now() - startTime);
					return staticResponse;
				}

				// Use file-based router for all other requests
				const response = await self.fileRouter.handleRequest(request);
				self.logger.http(request, response, Date.now() - startTime);
				return response;
			},
		};
	}

	async start(): Promise<OmbrageServer> {
		this.logger.info("Starting server...");
		const serverOptions = await this.init();
		const server = Bun.serve(serverOptions);
		this.logger.info(`Server running at ${server.url}`);
		return server;
	}

	static stop() {
		const logger = getLogger();
		logger.info("Stopping server...");
		logger.info("Shutting down gracefully...");
		try {
			Api.instance?.stop();
		} catch (error) {
			logger.error("Error stopping server:", error);
		} finally {
			logger.info("Server stopped.");
			process.exit();
		}
	}
}

process.on("SIGINT", () => {
	Api.stop();
});
process.on("SIGTERM", () => {
	Api.stop();
});
