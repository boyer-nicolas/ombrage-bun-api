import fs from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { AppConfig } from "@lib/config";
import packageJson from "../package.json";
import type { Route } from "./route";

interface RouteModule {
	path: string;
	routeFile?: string;
	serviceFile?: string;
	specFile?: string;
	route?: Route<unknown>;
	service?: unknown;
	spec?: unknown;
}

const config = AppConfig.get();

export type OpenAPISpec = {
	openapi: string;
	info: {
		title: string;
		description: string;
		version: string;
	};
	servers: Array<{
		url: string;
		description: string;
	}>;
	paths: Record<string, unknown>;
};

export class FileRouter {
	private routes: Map<string, RouteModule> = new Map();
	private basePath: string;

	constructor(basePath: string = "./routes") {
		this.basePath = basePath;
	}

	/**
	 * Scan the routes directory and discover all route modules
	 */
	async discoverRoutes(): Promise<void> {
		this.routes.clear();
		await this.scanDirectory(this.basePath);
	}

	/**
	 * Recursively scan directories for route files
	 */
	private async scanDirectory(dirPath: string): Promise<void> {
		try {
			// Use Node.js fs APIs which are available in Bun

			try {
				await fs.access(dirPath);
			} catch {
				return; // Directory doesn't exist
			}

			const entries = await fs.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(dirPath, entry.name);

				if (entry.isDirectory()) {
					await this.scanDirectory(fullPath);
				} else if (
					entry.isFile() &&
					(entry.name === "route.ts" ||
						entry.name === "service.ts" ||
						entry.name === "spec.ts")
				) {
					await this.processRouteFile(fullPath, entry.name);
				}
			}
		} catch (error) {
			console.warn(`Failed to scan directory ${dirPath}:`, error);
		}
	}

	/**
	 * Process discovered route files
	 */
	private async processRouteFile(
		filePath: string,
		fileName: string,
	): Promise<void> {
		const dirPath = dirname(filePath);
		const routePath = this.getRoutePath(dirPath);

		let routeModule = this.routes.get(routePath);
		if (!routeModule) {
			routeModule = { path: routePath };
			this.routes.set(routePath, routeModule);
		}

		// Set the file path based on the file type
		switch (fileName) {
			case "route.ts":
				routeModule.routeFile = filePath;
				break;
			case "service.ts":
				routeModule.serviceFile = filePath;
				break;
			case "spec.ts":
				routeModule.specFile = filePath;
				break;
		}
	}

	/**
	 * Convert file system path to route path
	 */
	private getRoutePath(dirPath: string): string {
		const relativePath = relative(this.basePath, dirPath);
		return `/${relativePath.split(sep).join("/")}`;
	}

	/**
	 * Load and instantiate all discovered routes
	 */
	async loadRoutes(): Promise<void> {
		for (const [path, routeModule] of this.routes) {
			try {
				await this.loadRouteModule(routeModule);
			} catch (error) {
				console.error(`Failed to load route at ${path}:`, error);
			}
		}
	}

	/**
	 * Load a specific route module
	 */
	private async loadRouteModule(routeModule: RouteModule): Promise<void> {
		// Load service first if it exists
		if (routeModule.serviceFile) {
			const serviceModule = await import(routeModule.serviceFile);
			const ServiceClass = this.findExportedClass(serviceModule);
			if (ServiceClass) {
				routeModule.service = new ServiceClass();
			}
		}

		// Load spec if it exists
		if (routeModule.specFile) {
			routeModule.spec = await import(routeModule.specFile);
		}

		// Load route and instantiate with service
		if (routeModule.routeFile) {
			const routeModuleImport = await import(routeModule.routeFile);
			const RouteClass = this.findExportedClass(routeModuleImport);
			if (RouteClass) {
				routeModule.route = new RouteClass(
					routeModule.service,
				) as Route<unknown>;
			}
		}
	}

	/**
	 * Find the first exported class in a module
	 */
	private findExportedClass(
		module: Record<string, unknown>,
	): (new (...args: unknown[]) => unknown) | null {
		for (const key in module) {
			const exported = module[key];
			if (typeof exported === "function" && exported.prototype) {
				return exported as new (
					...args: unknown[]
				) => unknown;
			}
		}
		return null;
	}

	/**
	 * Handle an HTTP request using the file-based routing
	 */
	async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Find matching route
		const routeModule = this.findMatchingRoute(path);
		if (!routeModule || !routeModule.route) {
			return Response.json(
				{
					error: "Not Found",
					message: `Route ${path} not found`,
					status: 404,
				},
				{ status: 404 },
			);
		}

		const method = request.method as keyof Route<unknown>;
		const handler = routeModule.route[method];

		if (!handler || typeof handler !== "function") {
			return Response.json(
				{
					error: "Method Not Allowed",
					message: `Method ${method} not allowed for ${path}`,
					status: 405,
				},
				{ status: 405 },
			);
		}

		try {
			return await handler({ request });
		} catch (error) {
			console.error(`Error handling ${method} ${path}:`, error);
			return Response.json(
				{
					error: "Internal Server Error",
					message: "An unexpected error occurred",
					status: 500,
				},
				{ status: 500 },
			);
		}
	}

	/**
	 * Find the best matching route for a given path
	 */
	private findMatchingRoute(requestPath: string): RouteModule | undefined {
		// First try exact match
		const exactMatch = this.routes.get(requestPath);
		if (exactMatch) {
			return exactMatch;
		}

		// Try to find the closest parent route
		let bestMatch: RouteModule | undefined;
		let bestMatchLength = 0;

		for (const [routePath, routeModule] of this.routes) {
			if (
				requestPath.startsWith(routePath) &&
				routePath.length > bestMatchLength
			) {
				bestMatch = routeModule;
				bestMatchLength = routePath.length;
			}
		}

		return bestMatch;
	}

	/**
	 * Get all discovered routes
	 */
	getRoutes(): Map<string, RouteModule> {
		return new Map(this.routes);
	}

	/**
	 * Get route information for debugging
	 */
	getRouteInfo(): Array<{
		path: string;
		hasRoute: boolean;
		hasService: boolean;
		hasSpec: boolean;
	}> {
		return Array.from(this.routes.entries()).map(([path, module]) => ({
			path,
			hasRoute: !!module.routeFile,
			hasService: !!module.serviceFile,
			hasSpec: !!module.specFile,
		}));
	}

	/**
	 * Generate OpenAPI specification from all spec files
	 */
	generateOpenAPISpec(): OpenAPISpec {
		const baseSpec: OpenAPISpec = {
			openapi: "3.0.3",
			info: {
				title: config.title,
				description: config.description,
				version: packageJson.version,
			},
			servers: [
				{
					url: `http://${config.server.host}:${config.server.port}`,
					description: "Development server",
				},
			],
			paths: {} as Record<string, unknown>,
		};

		// Combine all spec files into the paths object
		for (const [path, routeModule] of this.routes) {
			if (routeModule.spec) {
				try {
					// Get the first exported object from the spec module
					const specData = this.getSpecData(routeModule.spec);
					if (specData) {
						Object.assign(baseSpec.paths, specData);
					}
				} catch (error) {
					console.warn(`Failed to process spec for route ${path}:`, error);
				}
			}
		}

		return baseSpec;
	}

	/**
	 * Extract spec data from a spec module
	 */
	private getSpecData(specModule: unknown): unknown {
		// Type guard to check if specModule has string keys
		if (typeof specModule !== "object" || specModule === null) {
			return null;
		}

		const typedSpecModule = specModule as Record<string, unknown>;

		// Try to find exported spec data
		for (const key in specModule) {
			const exported = typedSpecModule[key];
			if (typeof exported === "object" && exported !== null) {
				return exported;
			}
		}
		return null;
	}

	/**
	 * Serve Swagger UI HTML
	 */
	getSwaggerUIHTML(): string {
		return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="SwaggerUI" />
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
<script>
  window.onload = () => {
    window.ui = SwaggerUIBundle({
      url: '/api-docs.json',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.presets.standalone,
      ],
      layout: "BaseLayout",
      plugins: [
        SwaggerUIBundle.plugins.DownloadUrl
      ],
      deepLinking: true,
      showExtensions: true,
      showCommonExtensions: true
    });
  };
</script>
</body>
</html>`;
	}

	/**
	 * Handle Swagger UI related requests
	 */
	handleSwaggerRequest(pathname: string): Response | null {
		if (pathname === "/") {
			return new Response(this.getSwaggerUIHTML(), {
				headers: { "Content-Type": "text/html" },
			});
		}

		if (pathname === "/api-docs.json") {
			const openapiSpec = this.generateOpenAPISpec();

			return Response.json(openapiSpec);
		}

		return null;
	}
}
