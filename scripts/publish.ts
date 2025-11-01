#!/usr/bin/env bun

/**
 * Local publishing script
 * Performs all checks before publishing locally
 */

import { $ } from "bun";

console.log("📦 Preparing to publish package locally...");

try {
	console.log("🔍 Running type checks...");
	await $`bun run check`;

	console.log("🧹 Running linter...");
	await $`bun run lint`;

	console.log("🧪 Running tests...");
	await $`bun run test`;

	console.log("🏗️  Building package...");
	await $`bun run build`;

	console.log("📋 Generating changelog and bumping version...");
	await $`bun run changelogen --release --bump`;

	console.log("📤 Publishing to NPM...");
	await $`bun publish --access public --tag latest --ignore-scripts`;

	console.log("🏷️  Pushing tags...");
	await $`git push --follow-tags`;

	console.log("✅ Package published successfully!");
} catch (error) {
	console.error("❌ Publishing failed:", error);
	process.exit(1);
}
