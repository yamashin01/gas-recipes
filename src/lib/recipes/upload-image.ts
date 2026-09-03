// レシピ本文に埋め込む画像のアップロード（issue #20）。api.admin.images.ts
// （multipart/form-data を扱う plain な server route）を叩く薄いラッパー。
// createServerFn 経由にしていないのは、その RPC 形式が File を素直に
// 扱えないため（routes/api.admin.images.ts のコメント参照）。
export async function uploadRecipeImage(file: File): Promise<string> {
	const formData = new FormData();
	formData.append("file", file);

	const response = await fetch("/api/admin/images", {
		method: "POST",
		body: formData,
	});
	const result = (await response.json().catch(() => null)) as {
		url?: string;
		error?: string;
	} | null;

	if (!response.ok || !result?.url) {
		throw new Error(result?.error ?? "画像のアップロードに失敗しました");
	}
	return result.url;
}
