import { describe, expect, test } from "bun:test";
import { Api, type ProxyHandler } from "../../src";

describe("Proxy Config Handler Preservation", () => {
	test("should preserve handlers during config validation", () => {
		const testHandler: ProxyHandler = async () => {
			return { proceed: false };
		};

		const api = new Api({
			environment: "test",
			server: {
				port: 0,
				routes: { dir: "./tests/fixtures/routes" },
			},
			proxy: {
				enabled: true,
				configs: [
					{
						pattern: "/test/*",
						target: "https://example.com",
						handler: testHandler,
					},
				],
			},
		});

		// Check that the handler is preserved in the config
		expect(api.config.proxy?.enabled).toBe(true);
		expect(api.config.proxy?.configs).toHaveLength(1);
		expect(api.config.proxy?.configs?.[0]?.handler).toBe(testHandler);
	});
});
