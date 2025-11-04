import type { Config } from "./config";

export const getLogger = (level?: Config["server"]["logLevel"]) => {
	const levels = [
		"debug",
		"info",
		"warning",
		"error",
		"trace",
		"fatal",
		"http",
	];
	const currentLevelIndex = levels.indexOf(level || "info");

	// Color codes for different log levels
	const colors = {
		debug: "\x1b[36m", // Cyan
		info: "\x1b[32m", // Green
		warning: "\x1b[33m", // Yellow
		error: "\x1b[31m", // Red
		trace: "\x1b[35m", // Magenta
		fatal: "\x1b[41m", // Red background
		http: "\x1b[34m", // Blue
		reset: "\x1b[0m", // Reset
	};

	const log = (msgLevel: string, ...args: unknown[]) => {
		if (levels.indexOf(msgLevel) >= currentLevelIndex) {
			const color = colors[msgLevel as keyof typeof colors] || "";
			const levelLabel = `[${msgLevel.toUpperCase()}]`;

			// Map log levels to valid console methods
			const consoleMethod =
				msgLevel === "fatal"
					? "error"
					: msgLevel === "warning"
						? "warn"
						: msgLevel === "trace"
							? "log"
							: msgLevel === "http"
								? "info"
								: (msgLevel as keyof typeof console);

			// biome-ignore lint/suspicious/noExplicitAny: Logging utility
			(console as any)[consoleMethod](
				`${color}${levelLabel}${colors.reset}`,
				...args,
			);
		}
	};

	return {
		debug: (...args: unknown[]) => log("debug", ...args),
		info: (...args: unknown[]) => log("info", ...args),
		warning: (...args: unknown[]) => log("warning", ...args),
		warn: (...args: unknown[]) => log("warning", ...args),
		error: (...args: unknown[]) => log("error", ...args),
		trace: (...args: unknown[]) => log("trace", ...args),
		fatal: (...args: unknown[]) => log("fatal", ...args),
		http: (request: Request, response: Response, duration: number) => {
			const { method, url } = request;
			const status = response.status;
			log("http", `${method} ${url} => ${status} (${duration}ms)`);
		},
	};
};

export type Logger = ReturnType<typeof getLogger>;
