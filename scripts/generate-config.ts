import fs from "node:fs/promises";
import { ConfigSchema } from "../packages/api/src";

const envDocPath = "./docs/configuration.md";

export async function generateEnvDocumentation(): Promise<string> {
	const config = ConfigSchema.parse({});
	const lines: string[] = [];

	lines.push("# Configuration Options");
	lines.push("");
	lines.push(
		"This document outlines the available configuration options for the Ombrage Bun API server. You can configure the server using environment variables or by providing a configuration object when initializing the server.",
	);
	lines.push("");
	// App Config options
	lines.push("");
	lines.push(
		"You can also configure the application using the `AppConfig` class:",
	);
	lines.push("");
	lines.push("```ts");
	lines.push("import { Server } from 'ombrage-bun-api';");
	lines.push("");
	lines.push(`new Server(${JSON.stringify(config, null, 2)}).start();`);
	lines.push("");
	lines.push("// Server is now configured with the above options");
	lines.push("```");
	lines.push("");

	return lines.join("\n");
}

// If this script is run directly, generate the env documentation and write to file
if (import.meta.main) {
	const docContent = await generateEnvDocumentation();
	await fs.writeFile(envDocPath, docContent, "utf-8");
	console.log(`Configuration docs generated at ${envDocPath}`);
}
