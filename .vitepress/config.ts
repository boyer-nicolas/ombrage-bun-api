import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { type DefaultTheme, defineConfig } from "vitepress";

function buildSidebar(): DefaultTheme.SidebarItem[] {
	const docsPath = resolve(__dirname, "../docs");

	// Function to convert filename/dirname to title
	const getTitle = (name: string): string => {
		return name
			.replace(".md", "")
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	// Function to recursively build sidebar items
	const buildSidebarItems = (
		dirPath: string,
		basePath = "",
	): DefaultTheme.SidebarItem[] => {
		const items: DefaultTheme.SidebarItem[] = [];

		try {
			const entries = readdirSync(dirPath).sort();

			for (const entry of entries) {
				const fullPath = join(dirPath, entry);
				const stat = statSync(fullPath);

				if (entry === "index.md" || entry === "node_modules") {
					continue; // Skip index.md and node_modules
				}

				if (stat.isDirectory()) {
					// Handle subdirectories
					const subItems = buildSidebarItems(fullPath, `${basePath}/${entry}`);
					if (subItems.length > 0) {
						items.push({
							text: getTitle(entry),
							collapsed: false,
							items: subItems,
						});
					}
				} else if (entry.endsWith(".md")) {
					// Handle markdown files
					const link = basePath
						? `${basePath}/${entry.replace(".md", "")}`
						: `/${entry.replace(".md", "")}`;
					items.push({
						text: getTitle(entry),
						link,
					});
				}
			}
		} catch (error) {
			console.warn(`Error reading directory ${dirPath}:`, error);
		}

		return items;
	};

	// Define custom order for main sections
	const sectionOrder = [
		"getting-started",
		"core-concepts",
		"examples-patterns",
	];

	const sidebar: DefaultTheme.SidebarItem[] = [];

	// Add sections in specified order
	for (const sectionName of sectionOrder) {
		const sectionPath = join(docsPath, sectionName);
		try {
			if (statSync(sectionPath).isDirectory()) {
				const sectionItems = buildSidebarItems(sectionPath, `/${sectionName}`);
				if (sectionItems.length > 0) {
					sidebar.push({
						text: getTitle(sectionName),
						collapsed: false,
						items: sectionItems,
					});
				}
			}
		} catch {
			// Section doesn't exist, skip it
		}
	}

	// Add any remaining directories not in the specified order
	const remainingEntries = readdirSync(docsPath).filter((entry) => {
		const fullPath = join(docsPath, entry);
		return (
			statSync(fullPath).isDirectory() &&
			!sectionOrder.includes(entry) &&
			entry !== "node_modules"
		);
	});

	for (const entry of remainingEntries) {
		const sectionPath = join(docsPath, entry);
		const sectionItems = buildSidebarItems(sectionPath, `/${entry}`);
		if (sectionItems.length > 0) {
			sidebar.push({
				text: getTitle(entry),
				collapsed: false,
				items: sectionItems,
			});
		}
	}

	return sidebar;
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
	srcDir: "docs",
	title: "Ombrage Bun API",
	description: "A File-based routing API framework",
	themeConfig: {
		search: {
			provider: "local",
		},
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Docs", link: "/getting-started/getting-started" },
			{
				text: "Examples",
				link: "https://github.com/boyer-nicolas/ombrage-bun-api/tree/main/packages/examples",
			},
		],
		sidebar: buildSidebar(),

		socialLinks: [
			{
				icon: "github",
				link: "https://github.com/boyer-nicolas/ombrage-bun-api",
			},
			{
				icon: "npm",
				link: "https://www.npmjs.com/package/ombrage-bun-api",
			},
		],
	},
});
