import { Server } from "../src";

new Server({
	server: {
		port: 8080,
		routesDir: "./dev/routes",
		logLevel: "debug",
	},
	title: "Dev API Server",
}).start();
