import { describe, expect, it } from "vitest";
import {
	normalizeSearchQuery,
	SEARCH_MAX_LENGTH,
	toLikePattern,
} from "./search-query";

describe("normalizeSearchQuery", () => {
	it("trims surrounding whitespace", () => {
		expect(normalizeSearchQuery("  スプレッドシート  ")).toBe(
			"スプレッドシート",
		);
	});

	it("collapses runs of whitespace, including full-width spaces", () => {
		expect(normalizeSearchQuery("gmail　　送信\t\tスクリプト")).toBe(
			"gmail 送信 スクリプト",
		);
	});

	it("returns undefined for values that should not trigger a search", () => {
		expect(normalizeSearchQuery("")).toBeUndefined();
		expect(normalizeSearchQuery("   ")).toBeUndefined();
		// 1文字はトライグラム索引が効かないため検索しない
		expect(normalizeSearchQuery("あ")).toBeUndefined();
		expect(normalizeSearchQuery(undefined)).toBeUndefined();
		expect(normalizeSearchQuery(42)).toBeUndefined();
	});

	it("truncates overly long queries", () => {
		const query = normalizeSearchQuery("あ".repeat(SEARCH_MAX_LENGTH + 50));
		expect(query).toHaveLength(SEARCH_MAX_LENGTH);
	});
});

describe("toLikePattern", () => {
	it("wraps the query for partial matching", () => {
		expect(toLikePattern("シート")).toBe("%シート%");
	});

	it("escapes LIKE wildcards so they match literally", () => {
		expect(toLikePattern("100%")).toBe("%100\\%%");
		expect(toLikePattern("get_range")).toBe("%get\\_range%");
		expect(toLikePattern("a\\b")).toBe("%a\\\\b%");
	});
});
