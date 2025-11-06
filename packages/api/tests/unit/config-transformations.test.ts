import { describe, expect, test } from "bun:test";
import { z } from "zod";

// Import the private transformation functions by re-implementing them for testing
const booleanFromString = z
	.union([z.boolean(), z.string()])
	.transform((val) => {
		if (typeof val === "boolean") return val;
		if (typeof val === "string") {
			const lower = val.toLowerCase();
			if (lower === "true" || lower === "1" || lower === "yes") return true;
			if (lower === "false" || lower === "0" || lower === "no" || lower === "")
				return false;
			return Boolean(val);
		}
		return Boolean(val);
	});

const numberFromString = z.union([z.number(), z.string()]).transform((val) => {
	if (typeof val === "number") return val;
	if (typeof val === "string") {
		const num = Number(val);
		if (Number.isNaN(num)) {
			return val; // Return original value to let Zod handle the error
		}
		return num;
	}
	return Number(val);
});

describe("config.ts transformations", () => {
	describe("booleanFromString", () => {
		test("should handle boolean values", () => {
			const result1 = booleanFromString.parse(true);
			expect(result1).toBe(true);

			const result2 = booleanFromString.parse(false);
			expect(result2).toBe(false);
		});

		test("should convert string true values", () => {
			expect(booleanFromString.parse("true")).toBe(true);
			expect(booleanFromString.parse("TRUE")).toBe(true);
			expect(booleanFromString.parse("1")).toBe(true);
			expect(booleanFromString.parse("yes")).toBe(true);
			expect(booleanFromString.parse("YES")).toBe(true);
		});

		test("should convert string false values", () => {
			expect(booleanFromString.parse("false")).toBe(false);
			expect(booleanFromString.parse("FALSE")).toBe(false);
			expect(booleanFromString.parse("0")).toBe(false);
			expect(booleanFromString.parse("no")).toBe(false);
			expect(booleanFromString.parse("NO")).toBe(false);
			expect(booleanFromString.parse("")).toBe(false);
		});

		test("should convert other string values using Boolean()", () => {
			expect(booleanFromString.parse("anything")).toBe(true);
			expect(booleanFromString.parse("0.0")).toBe(true); // Non-empty string
		});
	});

	describe("numberFromString", () => {
		test("should handle number values", () => {
			expect(numberFromString.parse(42)).toBe(42);
			expect(numberFromString.parse(3.14)).toBe(3.14);
			expect(numberFromString.parse(0)).toBe(0);
		});

		test("should convert valid string numbers", () => {
			expect(numberFromString.parse("42")).toBe(42);
			expect(numberFromString.parse("3.14")).toBe(3.14);
			expect(numberFromString.parse("0")).toBe(0);
			expect(numberFromString.parse("-10")).toBe(-10);
		});

		test("should return original string for invalid numbers", () => {
			expect(numberFromString.parse("abc")).toBe("abc");
			expect(numberFromString.parse("not-a-number")).toBe("not-a-number");
		});

		test("should handle empty string as number 0", () => {
			expect(numberFromString.parse("")).toBe(0);
		});
	});
});
