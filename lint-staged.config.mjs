
/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
	"*": [() => "bun run ./scripts/generate-config.ts"],
	"**/*.ts": [
		() => "bun run --filter ombrage-bun-api build",
		() => "bun run lint:fix",
		() => "bun run --filter ombrage-bun-api test:coverage",
		() => "bun run check",
	],
};

