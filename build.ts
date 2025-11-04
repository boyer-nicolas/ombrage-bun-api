import fs from "node:fs";

await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	sourcemap: false,
	packages: "external",
	minify: false,
	format: "cjs",
	target: "bun",
})
	.then(() => {
		console.log("Build completed successfully.");
		const bundleDir = "./dist";
		const bundleFiles = fs.readdirSync(bundleDir);
		let bundleSize = 0;

		bundleFiles.forEach((file) => {
			const filePath = `${bundleDir}/${file}`;
			const stats = fs.statSync(filePath);
			bundleSize += stats.size;
		});
		const readableSize = (size: number) => {
			const i = Math.floor(Math.log(size) / Math.log(1024));
			return `${(size / 1024 ** i).toFixed(2)} ${["B", "KB", "MB", "GB", "TB"][i]}`;
		};
		console.log(`Total bundle size: ${readableSize(bundleSize)}`);
	})
	.catch((error) => {
		console.error("Build failed:", error);
	});
