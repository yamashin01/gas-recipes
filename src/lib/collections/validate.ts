export type CollectionStatus = "draft" | "published";

export interface CollectionInput {
	title: string;
	slug: string;
	description: string;
	status: CollectionStatus;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// createServerFn の validator はクライアントから任意の値が送られてくる前提で
// 扱う必要があるため、型ガードを兼ねて手動で検証する（recipes/validate.ts と同じ方針）。
export function validateCollectionInput(input: unknown): CollectionInput {
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

	const description =
		typeof raw.description === "string" ? raw.description.trim() : "";
	const status: CollectionStatus =
		raw.status === "published" ? "published" : "draft";

	return { title, slug, description, status };
}
