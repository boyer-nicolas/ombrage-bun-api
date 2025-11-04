import type { Config } from "./config";

export const getLogger = (level?: Config["server"]["logLevel"]) => {
	const levels = ["debug", "info", "warning", "error", "trace", "fatal"];
	const currentLevelIndex = levels.indexOf(level || "info");

	const log = (msgLevel: string, ...args: unknown[]) => {
		if (levels.indexOf(msgLevel) >= currentLevelIndex) {
			// biome-ignore lint/suspicious/noExplicitAny: Logging utility
			(console as any)[msgLevel === "fatal" ? "error" : msgLevel](...args);
		}
	};

	return {
		debug: (...args: unknown[]) => log("debug", ...args),
		info: (...args: unknown[]) => log("info", ...args),
		warning: (...args: unknown[]) => log("warning", ...args),
		error: (...args: unknown[]) => log("error", ...args),
		trace: (...args: unknown[]) => log("trace", ...args),
		fatal: (...args: unknown[]) => log("fatal", ...args),
		http: (request: Request, response: Response, duration: number) => {
			const { method, url } = request;
			const status = response.status;
			log("info", `${method} ${url} - ${status} - ${duration}ms`);
		},
	};
};

export type Logger = ReturnType<typeof getLogger>;
