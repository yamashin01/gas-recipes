// タイトルからの自動サジェスト用（管理画面のクライアント側でのみ使用）。
// レシピの slug は URL に使うため ASCII のみを許可する（validate.ts で検証）。
export function slugify(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

// タグ名は日本語が中心で ASCII 化すると空文字になりやすいため、
// URL パスセグメントとして不正な文字だけを取り除き、Unicode はそのまま残す。
export function slugifyTagName(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[/\\?#%&=<>"']+/g, "")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}
