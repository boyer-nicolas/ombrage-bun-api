import fs from "node:fs/promises";

const envDocPath = "./docs/env.md";

export async function generateEnvDocumentation(): Promise<string> {
	console.log("Generating environment variable documentation...");
	const lines: string[] = [];
	lines.push("# Environment Variables");
	lines.push("");
	lines.push(
		"The following environment variables can be used to configure the application:",
	);
	lines.push("");

	// Vars are defined in a .d.ts file to use Bun's type system. Let's parse that file.
	const fileContents = await fs.readFile("./src/app.d.ts", "utf-8");
	const envInterfaceMatch = fileContents.match(/interface Env \{([\s\S]*?)\}/);
	if (!envInterfaceMatch) {
		throw new Error("Could not find Env interface in app.d.ts");
	}

	const envVarsBlock = envInterfaceMatch[1];
	if (!envVarsBlock) {
		throw new Error("Env interface is empty in app.d.ts");
	}
	const envVarLines = envVarsBlock.split("\n").map((line) => line.trim());

	for (const line of envVarLines) {
		if (line === "") continue;
		const varMatch = line.match(/^([A-Z0-9_]+):\s*([^;]+);/);
		if (varMatch) {
			const varName = varMatch[1];
			const varType = varMatch[2];
			lines.push(`- **${varName}**: \`${varType}\``);
		}

		lines.push("");
	}

	return lines.join("\n");
}

// If this script is run directly, generate the env documentation and write to file
if (import.meta.main) {
	const docContent = await generateEnvDocumentation();
	await fs.writeFile(envDocPath, docContent, "utf-8");
	console.log(`Environment variable documentation generated at ${envDocPath}`);
}
