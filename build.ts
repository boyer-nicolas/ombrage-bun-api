await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	sourcemap: "linked",
	minify: true,
	format: "cjs",
	target: "bun",
});
export {};
