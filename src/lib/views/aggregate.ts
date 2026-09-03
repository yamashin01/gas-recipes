import { env } from "cloudflare:workers";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../../db/client";
import { recipes } from "../../db/schema";
import { recipeViewCountKey } from "./record-view";

// Cron Triggers から日次で呼び出す閲覧数の集計（issue #21）。KV に溜まった
// レシピごとのカウンタを recipes.view_count へ反映し、KV 側は 0 に戻す。
export async function aggregateDailyViewCounts(): Promise<void> {
	const db = createDb(env.HYPERDRIVE.connectionString);

	try {
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

		// node-postgres は db.transaction() をサポートするため、Hyperdrive
		// 切り替え後はこちらを使う（neon-http 時代の db.batch() から変更。
		// docs/architecture.md §2、issue #22）。
		await db.transaction(async (tx) => {
			for (const { id, count } of increments) {
				await tx
					.update(recipes)
					.set({ viewCount: sql`${recipes.viewCount} + ${count}` })
					.where(eq(recipes.id, id));
			}
		});
	} finally {
		await db.$client.end();
	}
}
