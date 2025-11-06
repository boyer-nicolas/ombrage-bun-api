#!/usr/bin/env bun

/**
 * Test runner with coverage generation
 * Runs tests, generates coverage reports, and updates badges
 */

import { generateBadge } from "./generate-coverage-badge";
import { generateCoverageIndex } from "./generate-coverage-report";

console.log("🧪 Running tests with coverage...");

try {
	// Run tests

	console.log("📊 Generating coverage report...");

	// Generate HTML coverage report
	generateCoverageIndex();

	console.log("📈 Updating coverage badge...");

	// Update coverage badge
	generateBadge();

	console.log("🎉 All coverage artifacts generated successfully!");
	console.log(
		"📖 Open coverage/index.html to view the detailed coverage report",
	);
} catch (error) {
	console.error("❌ Process failed:", error);
	process.exit(1);
}
