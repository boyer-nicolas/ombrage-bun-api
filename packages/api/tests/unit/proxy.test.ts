import { describe, expect, test } from "bun:test";
import type { ProxyConfig } from "../../src/lib/config";
import {
	findMatchingProxyConfig,
	matchProxyPattern,
} from "../../src/lib/helpers";

describe("Proxy Pattern Matching", () => {
	describe("matchProxyPattern", () => {
		test("should match simple wildcard patterns", () => {
			const result = matchProxyPattern("/api/users", "/api/*");
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("users");
		});

		test("should match nested wildcard patterns", () => {
			const result = matchProxyPattern(
				"/users/123/profile",
				"/users/*/profile",
			);
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("123");
		});

		test("should match multiple wildcards", () => {
			const result = matchProxyPattern(
				"/tenants/acme/services/auth/data",
				"/tenants/*/services/*/data",
			);
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("acme");
			expect(result.params.param1).toBe("auth");
		});

		test("should not match when pattern doesn't align", () => {
			const result = matchProxyPattern("/different/path", "/api/*");
			expect(result.matched).toBe(false);
			expect(Object.keys(result.params)).toHaveLength(0);
		});

		test("should not match partial patterns", () => {
			const result = matchProxyPattern("/api/users/extra", "/api/*");
			expect(result.matched).toBe(false);
		});

		test("should handle exact matches without wildcards", () => {
			const result = matchProxyPattern("/exact/path", "/exact/path");
			expect(result.matched).toBe(true);
			expect(Object.keys(result.params)).toHaveLength(0);
		});

		test("should handle paths with special regex characters", () => {
			const result = matchProxyPattern("/api/test.json", "/api/*");
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("test.json");
		});

		test("should handle complex patterns with multiple segments", () => {
			const result = matchProxyPattern(
				"/v1/users/123/posts/456/comments",
				"/v1/users/*/posts/*/comments",
			);
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("123");
			expect(result.params.param1).toBe("456");
		});

		test("should match recursive patterns with double asterisk", () => {
			const result = matchProxyPattern("/auth/sign-up/email", "/auth/**");
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("sign-up/email");
		});

		test("should match deeply nested paths with double asterisk", () => {
			const result = matchProxyPattern(
				"/api/v1/users/123/posts/456/comments/789",
				"/api/**",
			);
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("v1/users/123/posts/456/comments/789");
		});

		test("should handle mixed single and double asterisk patterns", () => {
			const result = matchProxyPattern(
				"/tenants/acme/api/v1/users/123",
				"/tenants/*/api/**",
			);
			expect(result.matched).toBe(true);
			expect(result.params.param0).toBe("acme");
			expect(result.params.param1).toBe("v1/users/123");
		});
	});

	describe("findMatchingProxyConfig", () => {
		const mockConfigs: ProxyConfig[] = [
			{
				pattern: "/api/*",
				target: "https://api.example.com",
				description: "General API proxy",
				enabled: true,
				basePath: "/",
			},
			{
				pattern: "/api/auth/*",
				target: "https://auth.example.com",
				description: "Auth-specific proxy",
				enabled: true,
				basePath: "/",
			},
			{
				pattern: "/users/*/profile",
				target: "https://users.example.com",
				description: "User profile proxy",
				enabled: true,
				basePath: "/",
			},
			{
				pattern: "/disabled/*",
				target: "https://disabled.example.com",
				description: "Disabled proxy",
				enabled: false,
				basePath: "/",
			},
		];

		test("should find the most specific matching pattern", () => {
			const result = findMatchingProxyConfig("/api/auth/login", mockConfigs);
			expect(result).not.toBeNull();
			expect(result?.config.target).toBe("https://auth.example.com");
			expect(result?.config.description).toBe("Auth-specific proxy");
		});

		test("should fall back to less specific patterns when more specific don't match", () => {
			const result = findMatchingProxyConfig("/api/users", mockConfigs);
			expect(result).not.toBeNull();
			expect(result?.config.target).toBe("https://api.example.com");
			expect(result?.config.description).toBe("General API proxy");
		});

		test("should extract parameters correctly", () => {
			const result = findMatchingProxyConfig("/users/123/profile", mockConfigs);
			expect(result).not.toBeNull();
			expect(result?.params.param0).toBe("123");
			expect(result?.config.target).toBe("https://users.example.com");
		});

		test("should return null when no patterns match", () => {
			const result = findMatchingProxyConfig("/unmatched/path", mockConfigs);
			expect(result).toBeNull();
		});

		test("should ignore disabled configurations", () => {
			const result = findMatchingProxyConfig("/disabled/test", mockConfigs);
			expect(result).toBeNull();
		});

		test("should handle empty configuration array", () => {
			const result = findMatchingProxyConfig("/any/path", []);
			expect(result).toBeNull();
		});

		test("should prioritize patterns with fewer wildcards", () => {
			const configs: ProxyConfig[] = [
				{
					pattern: "/api/*",
					target: "https://general.example.com",
					enabled: true,
					basePath: "/",
				},
				{
					pattern: "/api/*/users",
					target: "https://specific.example.com",
					enabled: true,
					basePath: "/",
				},
				{
					pattern: "/api/v1/users",
					target: "https://exact.example.com",
					enabled: true,
					basePath: "/",
				},
			];

			// Most specific (no wildcards) should win
			const result1 = findMatchingProxyConfig("/api/v1/users", configs);
			expect(result1?.config.target).toBe("https://exact.example.com");

			// Medium specific (one wildcard) should win over general
			const result2 = findMatchingProxyConfig("/api/v2/users", configs);
			expect(result2?.config.target).toBe("https://specific.example.com");

			// General pattern when others don't match
			const result3 = findMatchingProxyConfig("/api/posts", configs);
			expect(result3?.config.target).toBe("https://general.example.com");
		});
	});

	test("should create proxy config with custom options", () => {
		const mockHandler = async () => ({ proceed: true });
		const config: ProxyConfig = {
			pattern: "/custom/*",
			target: "https://custom.example.com",
			enabled: false,
			description: "Custom proxy",
			headers: { "X-Custom": "value" },
			timeout: 5000,
			retries: 3,
			handler: mockHandler,
			basePath: "/",
		};

		expect(config.pattern).toBe("/custom/*");
		expect(config.target).toBe("https://custom.example.com");
		expect(config.enabled).toBe(false);
		expect(config.description).toBe("Custom proxy");
		expect(config.headers).toEqual({ "X-Custom": "value" });
		expect(config.timeout).toBe(5000);
		expect(config.retries).toBe(3);
		expect(config.handler).toBe(mockHandler);
	});

	test("should create proxy config without target for auth-only scenarios", () => {
		const authHandler = async () => ({
			proceed: false,
			response: new Response("Authorized", { status: 200 }),
		});

		const config: ProxyConfig = {
			pattern: "/auth/*",
			// No target provided - handled entirely by handler
			enabled: true,
			description: "Authentication-only proxy",
			handler: authHandler,
			basePath: "/",
		};

		expect(config.pattern).toBe("/auth/*");
		expect(config.target).toBeUndefined();
		expect(config.enabled).toBe(true);
		expect(config.description).toBe("Authentication-only proxy");
		expect(config.handler).toBe(authHandler);
	});

	test("should create proxy config with logging enabled by default", () => {
		const config: ProxyConfig = {
			pattern: "/api/*",
			target: "https://example.com",
			enabled: true,
			basePath: "/",
		};

		// logging should default to true
		expect(config.logging).toBeUndefined(); // undefined means default (true)
	});

	test("should create proxy config with logging explicitly disabled", () => {
		const config: ProxyConfig = {
			pattern: "/api/*",
			target: "https://example.com",
			enabled: true,
			logging: false,
			description: "API proxy with logging disabled",
			basePath: "/",
		};

		expect(config.pattern).toBe("/api/*");
		expect(config.target).toBe("https://example.com");
		expect(config.enabled).toBe(true);
		expect(config.logging).toBe(false);
		expect(config.description).toBe("API proxy with logging disabled");
	});

	test("should create proxy config with logging explicitly enabled", () => {
		const config: ProxyConfig = {
			pattern: "/api/*",
			target: "https://example.com",
			enabled: true,
			logging: true,
			description: "API proxy with logging enabled",
			basePath: "/",
		};

		expect(config.pattern).toBe("/api/*");
		expect(config.target).toBe("https://example.com");
		expect(config.enabled).toBe(true);
		expect(config.logging).toBe(true);
		expect(config.description).toBe("API proxy with logging enabled");
	});
});
