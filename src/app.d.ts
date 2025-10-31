declare module "bun" {
	interface Env {
		PORT: number;
		HOST: string;
		LOG_LEVEL: "debug" | "info" | "warn" | "error";
		SWAGGER_ENABLED: boolean;
		SWAGGER_PATH: string;
		API_TITLE: string;
		API_DESCRIPTION: string;
		AUTH_ENABLED: boolean;
		AUTH_SECRET: string;
		ENVIRONMENT: "development" | "production" | "test";
	}
}
