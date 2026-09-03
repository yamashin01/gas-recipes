import { env } from "cloudflare:workers";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { createDb } from "../../db/client";
import { recipes } from "../../db/schema";
import { recipeViewCountKey } from "./record-view";

function buildViewCountIncrement(db: Db, recipeId: string, increment: number) {
	return db
		.update(recipes)
		.set({ viewCount: sql`${recipes.viewCount} + ${increment}` })
		.where(eq(recipes.id, recipeId));
}

// Cron Triggers から日次で呼び出す閲覧数の集計（issue #21）。KV に溜まった
// レシピごとのカウンタを recipes.view_count へ反映し、KV 側は 0 に戻す。
export async function aggregateDailyViewCounts(): Promise<void> {
	const db = createDb(env.DATABASE_URL);

	const allRecipes = await db.select({ id: recipes.id }).from(recipes);

	const increments: { id: string; count: number }[] = [];
	for (const recipe of allRecipes) {
		const key = recipeViewCountKey(recipe.id);
		const raw = await env.VIEW_COUNTS_KV.get(key);
		const count = raw ? Number.parseInt(raw, 10) : 0;
		if (!Number.isFinite(count) || count <= 0) continue;

		// 集計後は 0 にリセットする（二重集計を避ける）。カウンタの取得と
		// リセットの間に新しい閲覧が挟まるレースは許容する（record-view.ts と
		// 同じ方針）。
		await env.VIEW_COUNTS_KV.put(key, "0");
		increments.push({ id: recipe.id, count });
	}

	if (increments.length === 0) {
		return;
	}

	// neon-http は db.transaction() 非対応のため db.batch() でまとめる
	// （admin-recipes.ts の syncRecipeTags 等と同じ方針）。
	const [first, ...rest] = increments;
	await db.batch([
		buildViewCountIncrement(db, first.id, first.count),
		...rest.map(({ id, count }) => buildViewCountIncrement(db, id, count)),
	]);
}
