import { env } from "cloudflare:workers";

// レシピ単位の閲覧数カウンタの KV キー。日付を含めず、集計（aggregate.ts）の
// たびに 0 へリセットして使い回す（issue #21）。
export function recipeViewCountKey(recipeId: string): string {
	return `view_count:${recipeId}`;
}

// 公開ページの応答性能に影響させないため、Neon へは書き込まず Workers KV の
// カウンタをインクリメントするだけに留める（docs/proposal.md §3.2・§4.1）。
// KV は read-modify-write を1操作で行うアトミックな increment を持たないため
// 同時アクセスで一部の増分を取りこぼすことがあるが、閲覧数はその程度のズレを
// 許容する用途のため問題にしない（rate_limit のような正確性が必要なカウンタ
// とは異なる方針。schema.ts の rate_limit コメント参照）。
export async function recordRecipeView(recipeId: string): Promise<void> {
	try {
		const key = recipeViewCountKey(recipeId);
		const current = await env.VIEW_COUNTS_KV.get(key);
		const parsed = current ? Number.parseInt(current, 10) : 0;
		const next = (Number.isFinite(parsed) ? parsed : 0) + 1;
		await env.VIEW_COUNTS_KV.put(key, String(next));
	} catch (error) {
		// 閲覧記録の失敗でページ表示自体を失敗させない
		console.error("[views] 閲覧数の記録に失敗しました", error);
	}
}
