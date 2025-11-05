
/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
	"*": [() => "bun run ./scripts/generate-config.ts"],
	"**/*.ts": [
		() => "bun run lint:fix",
		() => "bun test:coverage",
		() => "bun run check",
		() => "bun run build",
	],
};

