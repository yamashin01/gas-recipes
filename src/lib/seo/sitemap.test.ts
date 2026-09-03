import { describe, expect, it } from "vitest";
import { buildRobotsTxt, buildSitemapXml } from "./sitemap";

const ORIGIN = "https://gas-recipes.example.com";

describe("buildSitemapXml", () => {
	it("renders absolute URLs with lastmod", () => {
		const xml = buildSitemapXml(ORIGIN, [
			{
				path: "/recipes/gmail-auto-reply",
				lastModified: new Date("2026-08-30T01:23:45.000Z"),
				changeFrequency: "monthly",
			},
		]);

		expect(xml).toContain(`<loc>${ORIGIN}/recipes/gmail-auto-reply</loc>`);
		expect(xml).toContain("<lastmod>2026-08-30T01:23:45.000Z</lastmod>");
		expect(xml).toContain("<changefreq>monthly</changefreq>");
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
	});

	it("omits lastmod when the date is unknown", () => {
		const xml = buildSitemapXml(ORIGIN, [{ path: "/", lastModified: null }]);
		expect(xml).not.toContain("<lastmod>");
	});

	it("escapes XML special characters in URLs", () => {
		const xml = buildSitemapXml(ORIGIN, [{ path: "/tags/a%26b" }]);
		expect(xml).toContain(
			"<loc>https://gas-recipes.example.com/tags/a%26b</loc>",
		);
		expect(xml).not.toMatch(/<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
	});
});

describe("buildRobotsTxt", () => {
	it("points crawlers at the sitemap and blocks private paths", () => {
		const txt = buildRobotsTxt(ORIGIN);

		expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
		expect(txt).toContain("Disallow: /admin");
		expect(txt).toContain("Disallow: /api/");
		expect(txt).toContain("Disallow: /search");
	});
});
