import { describe, expect, it } from "vitest";
import {
	isCacheablePath,
	isCacheableRequest,
	isStorableResponse,
	PUBLIC_CACHE_CONTROL,
} from "./edge-cache-policy";

function req(url: string, init?: { method?: string; accept?: string }) {
	return {
		method: init?.method ?? "GET",
		url,
		headers: {
			get: (name: string) =>
				name.toLowerCase() === "accept" ? (init?.accept ?? "text/html") : null,
		},
	};
}

function res(status: number, headers: Record<string, string>) {
	return {
		status,
		headers: {
			get: (name: string) => headers[name.toLowerCase()] ?? null,
		},
	};
}

describe("isCacheablePath", () => {
	it("covers the public pages", () => {
		expect(isCacheablePath("/")).toBe(true);
		expect(isCacheablePath("/recipes")).toBe(true);
		expect(isCacheablePath("/recipes/")).toBe(true);
		expect(isCacheablePath("/recipes/gmail-auto-reply")).toBe(true);
		expect(isCacheablePath("/tags/spreadsheet")).toBe(true);
		expect(isCacheablePath("/search")).toBe(true);
		expect(isCacheablePath("/sitemap.xml")).toBe(true);
		expect(isCacheablePath("/robots.txt")).toBe(true);
	});

	it("excludes admin, auth and server function paths", () => {
		expect(isCacheablePath("/admin")).toBe(false);
		expect(isCacheablePath("/admin/recipes/new")).toBe(false);
		expect(isCacheablePath("/api/auth/callback/google")).toBe(false);
		expect(isCacheablePath("/api/health")).toBe(false);
		expect(isCacheablePath("/_serverFn/listPublishedRecipes")).toBe(false);
		// プレフィックスだけで実体の無いパスは対象外
		expect(isCacheablePath("/tags/")).toBe(false);
	});
});

describe("isCacheableRequest", () => {
	it("caches HTML document GETs", () => {
		expect(
			isCacheableRequest(
				req("https://example.com/recipes?page=2", {
					accept: "text/html,application/xhtml+xml",
				}),
			),
		).toBe(true);
	});

	it("does not cache non-GET requests", () => {
		expect(
			isCacheableRequest(
				req("https://example.com/recipes", { method: "POST" }),
			),
		).toBe(false);
	});

	it("does not cache non-document requests to public paths", () => {
		expect(
			isCacheableRequest(
				req("https://example.com/recipes", { accept: "application/json" }),
			),
		).toBe(false);
	});

	it("caches crawler files regardless of the Accept header", () => {
		expect(
			isCacheableRequest(
				req("https://example.com/robots.txt", { accept: "*/*" }),
			),
		).toBe(true);
		expect(
			isCacheableRequest(
				req("https://example.com/sitemap.xml", { accept: "*/*" }),
			),
		).toBe(true);
	});
});

describe("isStorableResponse", () => {
	it("stores successful public responses", () => {
		expect(
			isStorableResponse(res(200, { "cache-control": PUBLIC_CACHE_CONTROL })),
		).toBe(true);
	});

	it("never stores responses that set cookies", () => {
		expect(
			isStorableResponse(
				res(200, {
					"cache-control": PUBLIC_CACHE_CONTROL,
					"set-cookie": "session=abc",
				}),
			),
		).toBe(false);
	});

	it("skips non-200 responses and uncacheable directives", () => {
		expect(
			isStorableResponse(res(404, { "cache-control": PUBLIC_CACHE_CONTROL })),
		).toBe(false);
		expect(isStorableResponse(res(200, { "cache-control": "no-store" }))).toBe(
			false,
		);
		expect(
			isStorableResponse(res(200, { "cache-control": "private, max-age=60" })),
		).toBe(false);
		// Cache-Control が無いレスポンスは保存期間が決まらない
		expect(isStorableResponse(res(200, {}))).toBe(false);
	});
});
