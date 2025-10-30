import { AppConfig } from "@lib/config";
import { FileRouter } from "@lib/file-router";

// Initialize the file-based router
const fileRouter = new FileRouter("./routes");

const config = AppConfig.get();

// Discover and load all routes
await fileRouter.discoverRoutes();
await fileRouter.loadRoutes();

// Log discovered routes for debugging
console.debug("Discovered routes:");
console.debug(fileRouter.getRouteInfo());

const server = Bun.serve({
	port: config.server.port,
	hostname: config.server.host,
	async fetch(request) {
		const url = new URL(request.url);

		// Health check endpoint
		if (url.pathname === "/healthz") {
			return new Response("OK");
		}

		// Check for Swagger UI routes
		const swaggerResponse = fileRouter.handleSwaggerRequest(url.pathname);
		if (swaggerResponse) {
			return swaggerResponse;
		}

		// Use file-based router for all other requests
		return await fileRouter.handleRequest(request);
	},
});

console.log(`Server running at ${server.url}`);
