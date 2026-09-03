import { createServerFn } from "@tanstack/react-start";

// レシピ単位の閲覧数カウンタの KV キー接頭辞。閲覧のあったレシピの分だけ
// キーが存在する（集計時に env.VIEW_COUNTS_KV.list({ prefix }) で列挙できる
// ようにするため。aggregate.ts・issue #21）。
export const VIEW_COUNT_KEY_PREFIX = "view_count:";

export function recipeViewCountKey(recipeId: string): string {
	return `${VIEW_COUNT_KEY_PREFIX}${recipeId}`;
}

export function recipeIdFromViewCountKey(key: string): string {
	return key.slice(VIEW_COUNT_KEY_PREFIX.length);
}

// 公開ページの応答性能に影響させないため、Neon へは書き込まず Workers KV の
// カウンタをインクリメントするだけに留める（docs/proposal.md §3.2・§4.1）。
// KV は read-modify-write を1操作で行うアトミックな increment を持たないため
// 同時アクセスで一部の増分を取りこぼすことがあるが、閲覧数はその程度のズレを
// 許容する用途のため問題にしない（rate_limit のような正確性が必要なカウンタ
// とは異なる方針。schema.ts の rate_limit コメント参照）。
//
// KV バインディングは "cloudflare:workers" の env から直接 import せず、
// 呼び出し側（server function の context、または worker-entry.ts 経由の
// aggregate.ts）から渡してもらう。このモジュールは recordView 経由で
// recipes.$slug.tsx（クライアントコンポーネント）から import されるため、
// ここで "cloudflare:workers" を import するとクライアントバンドルの
// ビルドが壊れる（start.ts の AppRequestContext.viewCountsKv のコメント
// 参照）。
export async function recordRecipeView(
	kv: KVNamespace,
	recipeId: string,
): Promise<void> {
	try {
		const key = recipeViewCountKey(recipeId);
		const current = await kv.get(key);
		const parsed = current ? Number.parseInt(current, 10) : 0;
		const next = (Number.isFinite(parsed) ? parsed : 0) + 1;
		await kv.put(key, String(next));
	} catch (error) {
		// 閲覧記録の失敗でページ表示自体を失敗させない
		console.error("[views] 閲覧数の記録に失敗しました", error);
	}
}

// レシピ詳細ページのマウント時に呼ぶ専用 server function（PRレビュー指摘）。
// getPublishedRecipeBySlug の loader 内で直接記録すると、TanStack Router の
// defaultPreload: "intent"（src/router.tsx）により <Link> へのホバーだけで
// loader が RPC として呼ばれ、ページを開いていなくても加算されてしまう。
// クライアント側のマウント（useEffect）からのみ呼ぶことで、実際に開いた
// ときだけ加算されるようにする。
export const recordView = createServerFn({ method: "POST" })
	.validator((recipeId: unknown) => {
		if (typeof recipeId !== "string" || recipeId.length === 0) {
			throw new Error("recipeId は必須です");
		}
		return recipeId;
	})
	.handler(async ({ data: recipeId, context }) => {
		await recordRecipeView(context.viewCountsKv, recipeId);
	});
