#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Extract the latest release notes from CHANGELOG.md
 * and write them to a temporary file for GitHub release
 */
function extractLatestReleaseNotes() {
	const changelogPath = resolve(process.cwd(), "CHANGELOG.md");
	const outputPath = resolve(process.cwd(), "release-notes.md");

	try {
		const changelog = readFileSync(changelogPath, "utf-8");
		const lines = changelog.split("\n");

		let inLatestRelease = false;
		const releaseNotes: string[] = [];

		for (const line of lines) {
			// Start capturing when we find the first version header (after "# Changelog")
			if (line.match(/^## v\d+\.\d+\.\d+/)) {
				if (!inLatestRelease) {
					// This is the latest release, start capturing
					inLatestRelease = true;
					releaseNotes.push(line);
				} else {
					// We've hit the next release, stop capturing
					break;
				}
			} else if (inLatestRelease) {
				// Capture all lines for the current release
				releaseNotes.push(line);
			}
		}

		// Remove any trailing empty lines
		while (
			releaseNotes.length > 0 &&
			releaseNotes[releaseNotes.length - 1].trim() === ""
		) {
			releaseNotes.pop();
		}

		if (releaseNotes.length === 0) {
			console.warn("⚠️ No release notes found in changelog");
			writeFileSync(outputPath, "No release notes available.");
		} else {
			const releaseNotesContent = releaseNotes.join("\n");
			writeFileSync(outputPath, releaseNotesContent);
			console.log(`✅ Extracted release notes to ${outputPath}`);

			// Show a preview of what was extracted
			console.log("\n📋 Release notes preview:");
			console.log("=".repeat(50));
			console.log(
				releaseNotesContent.substring(0, 300) +
					(releaseNotesContent.length > 300 ? "..." : ""),
			);
			console.log("=".repeat(50));
		}
	} catch (error) {
		console.error("❌ Error extracting release notes:", error);
		// Create a fallback file
		writeFileSync(
			outputPath,
			"Release notes could not be extracted from changelog.",
		);
		process.exit(1);
	}
}

extractLatestReleaseNotes();
