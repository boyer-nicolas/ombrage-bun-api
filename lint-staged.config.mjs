
/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
	"*": [() => "bun run ./scripts/generate-config.ts"],
	"**/*.ts": [
		() => "bun run --filter koritsu build",
		() => "bun run lint:fix",
		() => "bun run --filter koritsu test:coverage",
		() => "bun run check",
	],
	"docs/**/*.md": [() => "bun run docs:build"],
};

