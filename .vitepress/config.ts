import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { type DefaultTheme, defineConfig } from "vitepress";

function buildSidebar(): DefaultTheme.SidebarItem[] {
	const docsPath = resolve(__dirname, "../docs");

	// Get all markdown files in the docs directory
	const files = readdirSync(docsPath)
		.filter((file) => file.endsWith(".md") && file !== "index.md") // Exclude index.md as it's the home page
		.sort();

	// Define the logical order for documentation
	const orderedFiles = [
		"getting-started.md",
		"routing.md",
		"openapi.md",
		"proxy.md",
		"examples.md",
	];

	// Function to convert filename to title
	const getTitle = (filename: string): string => {
		const name = filename.replace(".md", "");
		return name
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	// Build sidebar items in the specified order
	const items: DefaultTheme.SidebarItem[] = orderedFiles
		.filter((filename) => files.includes(filename))
		.map((filename) => ({
			text: getTitle(filename),
			link: `/${filename.replace(".md", "")}`,
		}));

	// Add any remaining files that weren't in the ordered list
	const remainingFiles = files.filter((file) => !orderedFiles.includes(file));
	const remainingItems = remainingFiles.map((filename) => ({
		text: getTitle(filename),
		link: `/${filename.replace(".md", "")}`,
	}));

	return [...items, ...remainingItems];
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
	srcDir: "docs",

	title: "Ombrage Bun API",
	description: "A File-based routing API framework",
	themeConfig: {
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Getting Started", link: "/getting-started" },
			{ text: "Examples", link: "/examples" },
		],
		sidebar: buildSidebar(),

		socialLinks: [
			{
				icon: "github",
				link: "https://github.com/boyer-nicolas/ombrage-bun-api",
			},
		],
	},
});
