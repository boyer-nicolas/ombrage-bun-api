import { Api } from "ombrage-bun-api";

console.log("Starting example API server...");

// Create and start the server using the built library
const server = new Api({
	server: {
		routes: {
			dir: "./routes",
		},
	},
	title: "Example API",
});
server.start();
