import fs from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { OpenAPIV3_1 } from "openapi-types";
import packageJson from "../../package.json";
import type { Config } from "./config";
import {
	type CustomSpec,
	generateOpenAPIFromCustomSpec,
	type SpecItem,
} from "./helpers";

interface RouteModule {
	path: string;
	routeFile?: string;
	routes?: Record<string, unknown>;
}

export class FileRouter {
	public routes: Map<string, RouteModule> = new Map();
	public basePath: string;
	public config: Config;

	constructor(config: Config) {
		this.basePath = resolve(config.server.routesDir);
		this.config = config;
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
			await fs.access(dirPath);
		} catch {
			throw new Error(`Directory ${dirPath} does not exist`);
		}

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(dirPath, entry.name);

				if (entry.isDirectory()) {
					await this.scanDirectory(fullPath);
				} else if (entry.isFile() && entry.name === "route.ts") {
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

		// Set the file path for route files only
		if (fileName === "route.ts") {
			routeModule.routeFile = filePath;
		}
	}

	/**
	 * Convert file system path to route path and extract parameter names
	 */
	private getRoutePath(dirPath: string): string {
		const relativePath = relative(this.basePath, dirPath);
		return `/${relativePath.split(sep).join("/")}`;
	}

	/**
	 * Convert a route path with [param] syntax to a regex pattern
	 */
	private routeToRegex(routePath: string): {
		regex: RegExp;
		paramNames: string[];
	} {
		const paramNames: string[] = [];

		// Replace [param] with named capture groups
		const regexPattern = routePath.replace(
			/\[([^\]]+)\]/g,
			(_match, paramName) => {
				paramNames.push(paramName);
				return "([^/]+)";
			},
		);

		// Ensure exact match
		const regex = new RegExp(`^${regexPattern}$`);

		return { regex, paramNames };
	}

	/**
	 * Extract parameters from a URL path using the route pattern
	 */
	private extractParams(
		requestPath: string,
		routePath: string,
	): Record<string, string> {
		const { regex, paramNames } = this.routeToRegex(routePath);
		const match = requestPath.match(regex);

		if (!match) {
			return {};
		}

		const params: Record<string, string> = {};
		paramNames.forEach((name, index) => {
			params[name] = match[index + 1] || "";
		});

		return params;
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
		// Load route functions if route file exists
		if (routeModule.routeFile) {
			const routeModuleImport = await import(routeModule.routeFile);
			routeModule.routes = routeModuleImport;
		}
	}

	/**
	 * Find the best matching route for a given path
	 */
	async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Find matching route
		const routeMatch = this.findMatchingRoute(path);
		if (!routeMatch || !routeMatch.module.routes) {
			return Response.json(
				{
					error: "Not Found",
					message: `Route ${path} not found`,
					status: 404,
				},
				{ status: 404 },
			);
		}

		const method = request.method;
		const handler = routeMatch.module.routes[method];

		if (!handler || typeof handler !== "object") {
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
			// Extract the callback from the route object
			const routeObject = handler as {
				callback?: (props: {
					request: Request;
					params?: Record<string, string>;
					body?: unknown;
					query?: Record<string, string>;
					headers?: Record<string, string>;
				}) => Promise<Response>;
			};
			if (!routeObject.callback || typeof routeObject.callback !== "function") {
				return Response.json(
					{
						error: "Method Not Allowed",
						message: `Method ${method} not implemented for ${path}`,
						status: 405,
					},
					{ status: 405 },
				);
			}

			// Parse query parameters
			const query: Record<string, string> = {};
			url.searchParams.forEach((value, key) => {
				query[key] = value;
			});

			// Extract headers as a simple object
			const headers: Record<string, string> = {};
			request.headers.forEach((value, key) => {
				headers[key] = value;
			});

			// Parse request body if present
			let body: unknown;
			if (request.headers.get("content-type")?.includes("application/json")) {
				try {
					body = await request.json();
				} catch {
					// Ignore JSON parsing errors, body will remain undefined
				}
			}

			return await routeObject.callback({
				request,
				params: routeMatch.params,
				body,
				query,
				headers,
			});
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
	private findMatchingRoute(
		requestPath: string,
	): { module: RouteModule; params: Record<string, string> } | undefined {
		// Try exact match first
		const exactMatch = this.routes.get(requestPath);
		if (exactMatch) {
			return { module: exactMatch, params: {} };
		}

		// Try dynamic routes
		for (const [routePath, routeModule] of this.routes) {
			// Check if route has dynamic segments
			if (routePath.includes("[") && routePath.includes("]")) {
				const { regex } = this.routeToRegex(routePath);
				if (regex.test(requestPath)) {
					const params = this.extractParams(requestPath, routePath);
					return { module: routeModule, params };
				}
			}
		}

		// Fall back to prefix matching for backward compatibility
		let bestMatch: RouteModule | undefined;
		let bestMatchLength = 0;

		for (const [routePath, routeModule] of this.routes) {
			// Skip dynamic routes in prefix matching
			if (routePath.includes("[") && routePath.includes("]")) {
				continue;
			}

			if (
				requestPath.startsWith(routePath) &&
				routePath.length > bestMatchLength
			) {
				bestMatch = routeModule;
				bestMatchLength = routePath.length;
			}
		}

		return bestMatch ? { module: bestMatch, params: {} } : undefined;
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
	getRouteInfo(): string[] {
		return Array.from(this.routes.entries()).map(([path]) => path);
	}

	/**
	 * Generate OpenAPI specification from inline specs in route files
	 */
	generateOpenAPISpec(): OpenAPIV3_1.Document {
		// Handle 0.0.0.0 as localhost for server URL, since the browser cannot reach
		// that address in Swagger UI
		let serverHost = this.config.server.host;
		if (serverHost === "0.0.0.0") {
			serverHost = "localhost";
		}
		const baseSpec: OpenAPIV3_1.Document = {
			openapi: "3.1.0",
			info: {
				title: this.config.title,
				description: this.config.description,
				version: packageJson.version,
			},
			servers: [
				{
					url: `http://${serverHost}:${this.config.server.port}`,
					description: "Development server",
				},
			],
			paths: {},
		};

		// Extract specs from route definitions
		for (const [path, routeModule] of this.routes) {
			if (routeModule.routes) {
				try {
					const methodSpecs: Record<string, unknown> = {};

					// Iterate through all exported route handlers
					for (const [exportName, routeHandler] of Object.entries(
						routeModule.routes,
					)) {
						// Skip non-HTTP method exports
						const httpMethod = exportName.toLowerCase();
						if (
							![
								"get",
								"post",
								"put",
								"delete",
								"patch",
								"head",
								"options",
							].includes(httpMethod)
						) {
							continue;
						}

						// Check if this route handler has a spec
						if (
							routeHandler &&
							typeof routeHandler === "object" &&
							"spec" in routeHandler
						) {
							const spec = (routeHandler as { spec?: unknown }).spec;
							if (spec) {
								methodSpecs[httpMethod] = spec;
							}
						}
					}

					// If we found any specs, process them
					if (Object.keys(methodSpecs).length > 0) {
						this.processInlineSpecs(path, methodSpecs, baseSpec);
					}
				} catch (error) {
					console.warn(
						`Failed to process inline specs for route ${path}:`,
						error,
					);
				}
			}
		}

		return baseSpec;
	}

	/**
	 * Process inline specs and add them to the OpenAPI document
	 */
	private processInlineSpecs(
		routePath: string,
		methodSpecs: Record<string, unknown>,
		baseSpec: OpenAPIV3_1.Document,
	): void {
		// Create a CustomSpec-like object from the method specs
		const customSpec: CustomSpec = {};

		for (const [method, spec] of Object.entries(methodSpecs)) {
			if (spec && typeof spec === "object") {
				customSpec[method] = spec as SpecItem;
			}
		}

		if (Object.keys(customSpec).length === 0) {
			return;
		}

		// Convert CustomSpec to OpenAPI format
		const openAPIFromCustom = generateOpenAPIFromCustomSpec(customSpec, {
			title: this.config.title,
			version: packageJson.version,
			description: this.config.description,
		});

		// Merge the paths from the converted spec
		if (openAPIFromCustom.paths && baseSpec.paths) {
			for (const [specPath, pathItem] of Object.entries(
				openAPIFromCustom.paths,
			)) {
				// Use the route path instead of the default "/"
				let actualPath = specPath === "/" ? routePath : routePath + specPath;
				// Convert [param] syntax to {param} for OpenAPI
				actualPath = actualPath.replace(/\[([^\]]+)\]/g, "{$1}");

				if (!baseSpec.paths[actualPath]) {
					baseSpec.paths[actualPath] = {};
				}

				if (pathItem && baseSpec.paths[actualPath]) {
					// Add 500 response to all operations if not already defined
					for (const [, operation] of Object.entries(pathItem)) {
						if (
							operation &&
							typeof operation === "object" &&
							"responses" in operation
						) {
							const op = operation as { responses?: Record<string, unknown> };
							if (!op.responses || !op.responses["500"]) {
								if (!op.responses) {
									op.responses = {};
								}
								op.responses["500"] = {
									description: "Internal server error",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: {
													error: { type: "string" },
													message: {
														type: "string",
														default: "An unexpected error occurred",
													},
												},
											},
										},
									},
								};
							}
						}
					}

					Object.assign(
						baseSpec.paths[actualPath] as Record<string, unknown>,
						pathItem,
					);
				}
			}
		}
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
  <title>${this.config.title} Documentation</title>
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
