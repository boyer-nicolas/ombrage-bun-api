
/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
	"src/app.d.ts": ["bun run ./scripts/generate-env.ts"],
	"**/*.ts": () => [
		"bun run lint:fix",
		"bun test --findRelatedTests",
		"bun run check",
		"bun run build",
		"bun run test --cwd example --findRelatedTests",
	],
};

