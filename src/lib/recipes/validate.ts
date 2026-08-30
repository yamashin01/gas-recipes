export type RecipeStatus = "draft" | "published";

export interface RecipeInput {
	title: string;
	slug: string;
	summary: string;
	bodyMd: string;
	status: RecipeStatus;
	tags: string[];
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// createServerFn の validator はクライアントから任意の値が送られてくる前提で
// 扱う必要があるため、型ガードを兼ねて手動で検証する（zod 等は未導入）。
export function validateRecipeInput(input: unknown): RecipeInput {
	if (typeof input !== "object" || input === null) {
		throw new Error("入力が不正です");
	}
	const raw = input as Record<string, unknown>;

	const title = typeof raw.title === "string" ? raw.title.trim() : "";
	if (!title) {
		throw new Error("タイトルは必須です");
	}

	const slug =
		typeof raw.slug === "string" ? raw.slug.trim().toLowerCase() : "";
	if (!SLUG_PATTERN.test(slug)) {
		throw new Error("スラッグは半角英数字とハイフンのみ使用できます");
	}

	const bodyMd = typeof raw.bodyMd === "string" ? raw.bodyMd : "";
	if (!bodyMd.trim()) {
		throw new Error("本文は必須です");
	}

	const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
	const status: RecipeStatus =
		raw.status === "published" ? "published" : "draft";
	const tags = Array.isArray(raw.tags)
		? raw.tags.filter((tag): tag is string => typeof tag === "string")
		: [];

	return { title, slug, summary, bodyMd, status, tags };
}
