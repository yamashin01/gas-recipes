import { describe, expect, it } from "vitest";
import { validateCollectionInput } from "./validate";

describe("validateCollectionInput", () => {
	const valid = {
		title: "GAS 入門シリーズ",
		slug: "gas-basics",
		description: "GAS を初めて触る人向けの連載です。",
		status: "draft",
	};

	it("returns a normalized CollectionInput for valid input", () => {
		expect(validateCollectionInput(valid)).toEqual({
			title: "GAS 入門シリーズ",
			slug: "gas-basics",
			description: "GAS を初めて触る人向けの連載です。",
			status: "draft",
		});
	});

	it("trims title, slug, and description", () => {
		const result = validateCollectionInput({
			...valid,
			title: "  GAS 入門シリーズ  ",
			slug: "  gas-basics  ",
			description: "  説明  ",
		});
		expect(result.title).toBe("GAS 入門シリーズ");
		expect(result.slug).toBe("gas-basics");
		expect(result.description).toBe("説明");
	});

	it("lowercases the slug", () => {
		const result = validateCollectionInput({ ...valid, slug: "GAS-Basics" });
		expect(result.slug).toBe("gas-basics");
	});

	it("defaults status to draft unless explicitly published", () => {
		expect(validateCollectionInput({ ...valid, status: "other" }).status).toBe(
			"draft",
		);
		expect(
			validateCollectionInput({ ...valid, status: "published" }).status,
		).toBe("published");
	});

	it("throws when input is not an object", () => {
		expect(() => validateCollectionInput(null)).toThrow("入力が不正です");
		expect(() => validateCollectionInput("x")).toThrow("入力が不正です");
	});

	it("throws when title is missing or blank", () => {
		expect(() => validateCollectionInput({ ...valid, title: "" })).toThrow(
			"タイトルは必須です",
		);
		expect(() => validateCollectionInput({ ...valid, title: "  " })).toThrow(
			"タイトルは必須です",
		);
	});

	it("throws when slug contains invalid characters", () => {
		expect(() =>
			validateCollectionInput({ ...valid, slug: "GAS 入門" }),
		).toThrow("スラッグは半角英数字とハイフンのみ使用できます");
		expect(() =>
			validateCollectionInput({ ...valid, slug: "-leading-hyphen" }),
		).toThrow("スラッグは半角英数字とハイフンのみ使用できます");
	});
});
