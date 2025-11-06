import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Api } from "ombrage-bun-api";
import { auth } from "./lib/auth";
import { db } from "./lib/db";

console.log("Starting example API server...");

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigrations() {
	console.info("Migrating database...");
	let retries = 10;
	while (retries > 0) {
		try {
			console.info(`Running migrations (retries left: ${retries})`);
			migrate(db, {
				migrationsFolder: "drizzle/",
			});
			console.info("Database migrated successfully.");
			return;
		} catch (error) {
			console.error(
				`Database connection failed. Retrying... (${retries} attempts left)`,
			);
			// This is the last retry, exit the process
			if (retries === 1) {
				console.error("Could not connect to the database. Exiting.");
				console.error(error);
				process.exit(1);
			}
			retries -= 1;
			await sleep(300);
		}
	}
}

// Create and start the server using the built library
const server = new Api({
	title: "Example Auth API",
	description: "An example API with Better Auth integration",
	server: {
		routes: {
			dir: "./routes",
		},
	},
	swagger: {
		enabled: true,
		path: "/",
		externalSpecs: [
			{
				url: "http://localhost:8080/auth/openapi",
				name: "better-auth",
				tags: ["Authentication"],
			},
		],
	},
	proxy: {
		enabled: true,
		configs: [
			{
				pattern: "/auth/**",
				// No target specified - auth is handled locally by better-auth
				description:
					"Authentication endpoints handled by better-auth (all levels)",
				handler: async ({ request }) => {
					console.log(`[AUTH] ${request.method} ${request.url}`);

					try {
						// Let better-auth handle the authentication request
						const response = await auth.handler(request);

						console.log(
							`[AUTH] Response status: ${response?.status || "no response"}`,
						);

						// If better-auth handled the request, return its response
						if (response) {
							return {
								proceed: false, // Don't proxy anywhere - we have the response
								response,
							};
						}

						// If better-auth didn't handle it, let it fall through to file routes
						return {
							proceed: false,
							response: new Response("Auth endpoint not found", {
								status: 404,
							}),
						};
					} catch (error) {
						console.error("[AUTH] Error handling request:", error);
						return {
							proceed: false,
							response: new Response("Internal auth error", { status: 500 }),
						};
					}
				},
			},
			{
				pattern: "/protected/**",
				description: "Protected routes requiring authentication",
				handler: async ({ request }) => {
					console.log(`[PROTECTED] ${request.method} ${request.url}`);

					try {
						// Validate session before proceeding to route handlers
						const session = await auth.api.getSession({
							headers: request.headers,
						});

						if (!session) {
							console.log("[PROTECTED] No valid session found");
							return {
								proceed: false,
								response: new Response("Unauthorized", { status: 401 }),
							};
						}

						console.log(
							`[PROTECTED] Authenticated user: ${session.user.email}`,
						);

						// Add user info to request headers for route handlers to use
						const headers = new Headers(request.headers);
						headers.set("x-user-id", session.user.id);
						headers.set("x-user-email", session.user.email);
						headers.set("x-user-name", session.user.name || "");

						// Create new request with user info
						const authenticatedRequest = new Request(request.url, {
							method: request.method,
							headers,
							body: request.body,
						});

						return {
							proceed: true, // Continue to route handlers
							request: authenticatedRequest,
						};
					} catch (error) {
						console.error("[PROTECTED] Session validation error:", error);
						return {
							proceed: false,
							response: new Response("Invalid session", { status: 401 }),
						};
					}
				},
			},
		],
	},
});

await runMigrations();

server.start();
