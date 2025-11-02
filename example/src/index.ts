import { Server } from "ombrage-bun-api";

console.log("Starting example API server...");

// Create and start the server using the built library
const server = new Server({
	server: {
		routesDir: "./routes",
	},
	title: "Example API Server",
});
server.start();
