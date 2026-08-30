import { describe, expect, it } from "vitest";
import { absoluteUrl, normalizeOrigin, pathWithQuery, seo } from "./site";

const ORIGIN = "https://gas-recipes.example.com";

describe("normalizeOrigin", () => {
	it("strips trailing slashes", () => {
		expect(normalizeOrigin(`${ORIGIN}/`)).toBe(ORIGIN);
		expect(normalizeOrigin(` ${ORIGIN}// `)).toBe(ORIGIN);
	});

	it("treats empty values as unset", () => {
		expect(normalizeOrigin("")).toBeUndefined();
		expect(normalizeOrigin("   ")).toBeUndefined();
		expect(normalizeOrigin(undefined)).toBeUndefined();
	});
});

describe("absoluteUrl", () => {
	it("joins origin and path", () => {
		expect(absoluteUrl("/recipes", ORIGIN)).toBe(`${ORIGIN}/recipes`);
		expect(absoluteUrl("recipes", ORIGIN)).toBe(`${ORIGIN}/recipes`);
	});

	it("returns undefined when the origin is unknown", () => {
		expect(absoluteUrl("/recipes", undefined)).toBeUndefined();
	});
});

describe("seo", () => {
	it("emits canonical and og:url when the origin is known", () => {
		const { meta, links } = seo({
			title: "レシピ一覧 | GAS Recipe Hub",
			description: "説明",
			path: "/recipes",
			origin: ORIGIN,
		});

		expect(links).toEqual([{ rel: "canonical", href: `${ORIGIN}/recipes` }]);
		expect(meta).toContainEqual({
			property: "og:url",
			content: `${ORIGIN}/recipes`,
		});
		expect(meta).toContainEqual({ property: "og:type", content: "website" });
		expect(meta).toContainEqual({ name: "description", content: "説明" });
	});

	it("omits canonical and og:url when the origin is unset", () => {
		const { meta, links } = seo({
			title: "レシピ一覧 | GAS Recipe Hub",
			path: "/recipes",
			origin: undefined,
		});

		expect(links).toEqual([]);
		expect(meta.some((tag) => tag.property === "og:url")).toBe(false);
		// description が無ければ og:description も出さない
		expect(meta.some((tag) => tag.property === "og:description")).toBe(false);
	});

	it("marks noindex pages so search results are not indexed", () => {
		const { meta } = seo({
			title: "検索 | GAS Recipe Hub",
			path: "/search",
			noindex: true,
			origin: ORIGIN,
		});

		expect(meta).toContainEqual({ name: "robots", content: "noindex, follow" });
	});
});

describe("pathWithQuery", () => {
	it("keeps meaningful params", () => {
		expect(pathWithQuery("/recipes", { tag: "gmail", page: 2 })).toBe(
			"/recipes?tag=gmail&page=2",
		);
	});

	it("drops empty values and the default first page", () => {
		expect(pathWithQuery("/recipes", { tag: undefined, page: 1 })).toBe(
			"/recipes",
		);
		expect(pathWithQuery("/recipes", { tag: "", page: 1 })).toBe("/recipes");
	});
});
