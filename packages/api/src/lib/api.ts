import { type Config, type ConfigInput, validateConfig } from "./config";
import {
	addCorsHeaders,
	type CorsOptions,
	handleCorsPreflightRequest,
} from "./helpers";
import { getLogger, type Logger } from "./logger";
import { FileRouter } from "./router";

export type KoritsuServer = Bun.Server<undefined>;

export class Api {
	public config: Config;
	public fileRouter: FileRouter;
	static instance?: KoritsuServer;
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

				// Helper function to add CORS headers to responses when CORS is enabled
				const wrapWithCors = (response: Response): Response => {
					if (self.config.cors?.enabled) {
						const corsOptions: CorsOptions = {
							origin: self.config.cors.origin,
							methods: self.config.cors.methods,
							allowedHeaders: self.config.cors.allowedHeaders,
							exposedHeaders: self.config.cors.exposedHeaders,
							credentials: self.config.cors.credentials,
							maxAge: self.config.cors.maxAge,
							optionsSuccessStatus: self.config.cors.optionsSuccessStatus,
						};
						return addCorsHeaders(response, request, corsOptions);
					}
					return response;
				};

				// Check for Swagger UI routes
				const swaggerResponse = await self.fileRouter.handleSwaggerRequest(
					url.pathname,
				);
				if (swaggerResponse) {
					return wrapWithCors(swaggerResponse);
				}

				if (url.pathname === "/favicon.ico") {
					// Bypass logging for favicon requests
					return new Response(null, { status: 204 });
				}

				// Handle CORS preflight requests
				if (self.config.cors?.enabled) {
					const corsOptions: CorsOptions = {
						origin: self.config.cors.origin,
						methods: self.config.cors.methods,
						allowedHeaders: self.config.cors.allowedHeaders,
						exposedHeaders: self.config.cors.exposedHeaders,
						credentials: self.config.cors.credentials,
						maxAge: self.config.cors.maxAge,
						optionsSuccessStatus: self.config.cors.optionsSuccessStatus,
					};

					const corsPreflightResponse = handleCorsPreflightRequest(
						request,
						corsOptions,
					);
					if (corsPreflightResponse) {
						self.logger.http(
							request,
							corsPreflightResponse,
							Date.now() - startTime,
						);
						return corsPreflightResponse;
					}
				}

				// Handle proxy requests first (before static files and routes)
				if (self.config.proxy?.enabled) {
					const proxyResponse =
						await self.fileRouter.handleProxyRequest(request);
					if (proxyResponse) {
						const finalResponse = wrapWithCors(proxyResponse);
						self.logger.http(request, finalResponse, Date.now() - startTime);
						return finalResponse;
					}
				}

				// Handle static file requests
				if (
					self.config.server.static?.enabled &&
					self.config.server.static.dir &&
					self.config.server.static.basePath &&
					url.pathname.startsWith(self.config.server.static.basePath)
				) {
					// Strip the static basePath prefix and handle the file request
					const staticPath = url.pathname.slice(
						self.config.server.static.basePath.length,
					);
					const staticResponse = await self.fileRouter.handleStaticRequest(
						staticPath || "/",
					);
					const finalResponse = wrapWithCors(staticResponse);
					self.logger.http(request, finalResponse, Date.now() - startTime);
					return finalResponse;
				}

				// Use file-based router for route requests
				// Only handle requests that match the routes basePath
				const routesBasePath = self.config.server.routes.basePath;
				if (
					routesBasePath !== "/" &&
					!url.pathname.startsWith(routesBasePath)
				) {
					// This is not a route request, return 404
					const response = Response.json(
						{
							error: "Not Found",
							message: `Route ${url.pathname} not found`,
							status: 404,
						},
						{ status: 404 },
					);
					const finalResponse = wrapWithCors(response);
					self.logger.http(request, finalResponse, Date.now() - startTime);
					return finalResponse;
				}

				const response = await self.fileRouter.handleRequest(request);
				const finalResponse = wrapWithCors(response);
				self.logger.http(request, finalResponse, Date.now() - startTime);
				return finalResponse;
			},
		};
	}

	async start(): Promise<KoritsuServer> {
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
