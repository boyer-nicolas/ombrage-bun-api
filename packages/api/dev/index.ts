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
	title: "Dev API Server",
	environment: "development",
}).start();
