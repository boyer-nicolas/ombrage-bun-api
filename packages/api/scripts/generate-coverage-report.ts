#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Generates a simple HTML coverage report index
 */
export function generateCoverageIndex() {
	const coverageDir = join(process.cwd(), "coverage");
	const indexPath = join(coverageDir, "index.html");

	if (!existsSync(coverageDir)) {
		console.error("Coverage directory not found");
		process.exit(1);
	}

	const lcovPath = join(coverageDir, "lcov.info");
	if (!existsSync(lcovPath)) {
		console.error("LCOV report not found");
		process.exit(1);
	}

	const lcovContent = readFileSync(lcovPath, "utf-8");

	// Parse coverage data
	const files: Array<{
		name: string;
		lines: number;
		covered: number;
		percentage: number;
	}> = [];
	let currentFile = "";
	let totalLines = 0;
	let coveredLines = 0;
	let globalTotal = 0;
	let globalCovered = 0;

	const lines = lcovContent.split("\n");

	for (const line of lines) {
		if (line.startsWith("SF:")) {
			currentFile = line.split(":")[1] || "";
		} else if (line.startsWith("LF:")) {
			totalLines = parseInt(line.split(":")[1] || "0", 10);
			globalTotal += totalLines;
		} else if (line.startsWith("LH:")) {
			coveredLines = parseInt(line.split(":")[1] || "0", 10);
			globalCovered += coveredLines;
		} else if (line.startsWith("end_of_record")) {
			if (currentFile) {
				const percentage =
					totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0;
				files.push({
					name: currentFile.replace(process.cwd(), ""),
					lines: totalLines,
					covered: coveredLines,
					percentage,
				});
			}
			currentFile = "";
			totalLines = 0;
			coveredLines = 0;
		}
	}

	const globalPercentage =
		globalTotal > 0 ? Math.round((globalCovered / globalTotal) * 100) : 0;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report - Ombrage API</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin: 0 0 20px 0; }
        .summary { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .percentage { font-size: 2em; font-weight: bold; }
        .green { color: #28a745; }
        .yellow { color: #ffc107; }
        .red { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; }
        .file-name { font-family: 'Monaco', 'Courier New', monospace; }
        .bar { width: 100px; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 10px; }
        .bar-green { background: #28a745; }
        .bar-yellow { background: #ffc107; }
        .bar-red { background: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Coverage Report</h1>
        
        <div class="summary">
            <h2>Overall Coverage</h2>
            <div class="percentage ${globalPercentage >= 80 ? "green" : globalPercentage >= 60 ? "yellow" : "red"}">
                ${globalPercentage}%
            </div>
            <p>${globalCovered}/${globalTotal} lines covered</p>
        </div>

        <h2>File Coverage</h2>
        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Coverage</th>
                    <th>Lines</th>
                    <th>Covered</th>
                    <th>Progress</th>
                </tr>
            </thead>
            <tbody>
                ${files
									.map(
										(file) => `
                    <tr>
                        <td class="file-name">${file.name}</td>
                        <td class="${file.percentage >= 80 ? "green" : file.percentage >= 60 ? "yellow" : "red"}">${file.percentage}%</td>
                        <td>${file.lines}</td>
                        <td>${file.covered}</td>
                        <td>
                            <div class="bar">
                                <div class="bar-fill ${file.percentage >= 80 ? "bar-green" : file.percentage >= 60 ? "bar-yellow" : "bar-red"}" 
                                     style="width: ${file.percentage}%"></div>
                            </div>
                        </td>
                    </tr>
                `,
									)
									.join("")}
            </tbody>
        </table>
        
        <p style="margin-top: 30px; color: #6c757d; font-size: 0.9em;">
            Generated on ${new Date().toLocaleString()} | 
            <a href="lcov.info" download>Download LCOV Report</a>
        </p>
    </div>
</body>
</html>`;

	writeFileSync(indexPath, html);
	console.log(`Coverage report generated: ${indexPath}`);
}

if (import.meta.main) {
	generateCoverageIndex();
}
