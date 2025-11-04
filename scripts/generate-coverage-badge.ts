#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Parses LCOV coverage report and generates a coverage badge
 */
function parseLcovCoverage(lcovPath: string): number {
	if (!existsSync(lcovPath)) {
		console.error(`LCOV file not found: ${lcovPath}`);
		process.exit(1);
	}

	const lcovContent = readFileSync(lcovPath, "utf-8");

	let totalLines = 0;
	let coveredLines = 0;

	// Parse LCOV format
	const lines = lcovContent.split("\n");

	for (const line of lines) {
		if (line.startsWith("LF:")) {
			// LF: number of instrumented lines
			totalLines += parseInt(line.split(":")[1] || "0", 10);
		} else if (line.startsWith("LH:")) {
			// LH: number of lines with a non-zero execution count
			coveredLines += parseInt(line.split(":")[1] || "0", 10);
		}
	}

	if (totalLines === 0) {
		console.error("No coverage data found in LCOV file");
		process.exit(1);
	}

	return Math.round((coveredLines / totalLines) * 100);
}

/**
 * Gets the color for the coverage badge based on percentage
 */
function getCoverageColor(percentage: number): string {
	if (percentage >= 90) return "brightgreen";
	if (percentage >= 80) return "green";
	if (percentage >= 70) return "yellowgreen";
	if (percentage >= 60) return "yellow";
	if (percentage >= 50) return "orange";
	return "red";
}

/**
 * Generates a shields.io badge URL for coverage
 */
function generateBadgeUrl(percentage: number): string {
	const color = getCoverageColor(percentage);
	return `https://img.shields.io/badge/coverage-${percentage}%25-${color}`;
}

/**
 * Updates the README.md file with the new coverage badge
 */
function updateReadmeBadge(
	badgeUrl: string,
	readmePath: string,
	coverage: number,
): void {
	if (!existsSync(readmePath)) {
		console.error(`README file not found: ${readmePath}`);
		process.exit(1);
	}

	let readmeContent = readFileSync(readmePath, "utf-8");

	// Pattern to match the coverage badge line
	const badgePattern = /!\[Coverage\]\(.*?\)/;
	const newBadge = `![Coverage](${badgeUrl})`;

	if (badgePattern.test(readmeContent)) {
		readmeContent = readmeContent.replace(badgePattern, newBadge);
	} else {
		// If no coverage badge exists, add it after the CI badge
		const ciPattern = /(!\[CI\].*?\))/;
		if (ciPattern.test(readmeContent)) {
			readmeContent = readmeContent.replace(ciPattern, `$1\n${newBadge}`);
		} else {
			console.warn("Could not find CI badge to insert coverage badge after");
			return;
		}
	}

	writeFileSync(readmePath, readmeContent);
	console.log(`Updated README.md with coverage badge: ${coverage}%`);
}

export function generateBadge() {
	const args = process.argv.slice(2);
	const lcovPath = args[0] || join(process.cwd(), "coverage", "lcov.info");
	const readmePath = args[1] || join(process.cwd(), "README.md");

	try {
		const coverage = parseLcovCoverage(lcovPath);
		const badgeUrl = generateBadgeUrl(coverage);

		console.log(`Coverage: ${coverage}%`);
		console.log(`Badge URL: ${badgeUrl}`);

		// In CI environment, just output the coverage for the workflow
		if (process.env.CI) {
			console.log(`::set-output name=coverage::${coverage}`);
			console.log(`::set-output name=badge-url::${badgeUrl}`);
		} else {
			// In local environment, update the README
			updateReadmeBadge(badgeUrl, readmePath, coverage);
		}
	} catch (error) {
		console.error("Error generating coverage badge:", error);
		process.exit(1);
	}
}

if (import.meta.main) {
	generateBadge();
}
