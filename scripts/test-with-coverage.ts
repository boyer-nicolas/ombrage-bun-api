#!/usr/bin/env bun

/**
 * Test runner with coverage generation
 * Runs tests, generates coverage reports, and updates badges
 */

import { $ } from "bun";

console.log("🧪 Running tests with coverage...");

try {
	// Run tests
	await $`bun test`;
	console.log("✅ Tests passed");

	console.log("📊 Generating coverage report...");

	// Generate HTML coverage report
	await $`bun run scripts/generate-coverage-report.ts`;

	console.log("📈 Updating coverage badge...");

	// Update coverage badge
	await $`bun run scripts/generate-coverage-badge.ts`;

	console.log("🎉 All coverage artifacts generated successfully!");
	console.log(
		"📖 Open coverage/index.html to view the detailed coverage report",
	);
} catch (error) {
	console.error("❌ Process failed:", error);
	process.exit(1);
}
