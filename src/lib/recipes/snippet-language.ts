// スニペットのシンタックスハイライト対象言語。highlight.js 側で登録している
// 言語（src/lib/recipes/highlight.ts）と一致させる。サーバー側の検証と
// クライアント側の選択肢（SnippetForm）の両方から参照する単一の定義。
export const SNIPPET_LANGUAGES = ["javascript", "json", "plaintext"] as const;

export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number];

export function isSnippetLanguage(value: string): value is SnippetLanguage {
	return (SNIPPET_LANGUAGES as readonly string[]).includes(value);
}

export const SNIPPET_LANGUAGE_LABELS: Record<SnippetLanguage, string> = {
	javascript: "JavaScript",
	json: "JSON",
	plaintext: "プレーンテキスト",
};
