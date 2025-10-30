import fs from "node:fs/promises";
import { AvailableEnvVars } from "@lib/config";

const envDocPath = "./docs/env.md";

export function generateEnvDocumentation(): string {
	const lines: string[] = [];
	lines.push("# Environment Variables");
	lines.push("");
	lines.push(
		"The following environment variables can be used to configure the application:",
	);
	lines.push("");

	for (const varName of Object.values(AvailableEnvVars)) {
		lines.push(`- **${varName}**`);
	}

	lines.push("");

	return lines.join("\n");
}

// If this script is run directly, generate the env documentation and write to file
if (import.meta.main) {
	const docContent = generateEnvDocumentation();
	await fs.writeFile(envDocPath, docContent, "utf-8");
	console.log(`Environment variable documentation generated at ${envDocPath}`);
}
