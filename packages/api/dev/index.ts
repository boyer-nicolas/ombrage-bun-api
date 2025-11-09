import { Api } from "../src";

new Api({
	server: {
		port: 8080,
		routes: {
			dir: "./dev/routes",
			basePath: "/",
		},
		logLevel: "info",
		static: {
			dir: "./dev/public",
			enabled: true,
			basePath: "/static",
		},
	},
	cors: {
		enabled: true,
		origin: [
			"http://localhost:3000",
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		],
		methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
		exposedHeaders: ["X-Total-Count"],
		maxAge: 3600,
	},
	title: "Dev API Server with CORS",
	environment: "development",
}).start();
