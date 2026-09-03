import { env } from "cloudflare:workers";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../../db/client";
import { recipes } from "../../db/schema";
import { recipeIdFromViewCountKey, VIEW_COUNT_KEY_PREFIX } from "./record-view";

interface PendingIncrement {
	key: string;
	recipeId: string;
	count: number;
}

// 1回の cron 実行で処理するキー数の上限。1キーあたり最大3回の KV 操作
// （スナップショット取得・最終確認取得・put/delete）に加え list() 自体の
// 1回で、Workers の 1 invocation あたり 1,000 回という上限に収まるよう
// 300 に抑える（PRレビュー指摘：list() は最大1,000件返し得るため無制限だと
// 上限を超える）。取りこぼした分は翌日以降の cron で処理される。
const MAX_KEYS_PER_RUN = 300;

// Cron Triggers から日次で呼び出す閲覧数の集計（issue #21・PRレビュー指摘）。
// 閲覧のあったレシピの分だけ存在する KV カウンタを env.VIEW_COUNTS_KV.list()
// で列挙して recipes.view_count へ反映する。全レシピを DB から読んで1件ずつ
// KV を get/put していた実装は、レシピ数に比例して KV 操作数が増え
// （Workers は 1 invocation あたり KV 操作 1,000 回が上限）、閲覧の無い
// レシピの分まで無駄に操作するため置き換えた。
export async function aggregateDailyViewCounts(): Promise<void> {
	const list = await env.VIEW_COUNTS_KV.list({
		prefix: VIEW_COUNT_KEY_PREFIX,
		limit: MAX_KEYS_PER_RUN,
	});
	if (list.keys.length === 0) {
		return;
	}

	const candidates = await Promise.all(
		list.keys.map(async (key): Promise<PendingIncrement | null> => {
			const raw = await env.VIEW_COUNTS_KV.get(key.name);
			const count = raw ? Number.parseInt(raw, 10) : 0;
			if (!Number.isFinite(count) || count <= 0) return null;
			return {
				key: key.name,
				recipeId: recipeIdFromViewCountKey(key.name),
				count,
			};
		}),
	);
	const increments = candidates.filter(
		(candidate): candidate is PendingIncrement => candidate !== null,
	);
	if (increments.length === 0) {
		return;
	}

	const db = createDb(env.HYPERDRIVE.connectionString);
	try {
		// node-postgres は db.transaction() をサポートするため、Hyperdrive
		// 切り替え後はこちらを使う（neon-http 時代の db.batch() から変更。
		// docs/architecture.md §2、issue #22）。
		//
		// DB への反映を KV のクリアより先に行う。逆順（先に KV をリセット）
		// だと、この transaction が失敗したときに集計対象だった閲覧数が
		// どこにも残らず失われる（PRレビュー指摘）。
		await db.transaction(async (tx) => {
			for (const { recipeId, count } of increments) {
				await tx
					.update(recipes)
					.set({ viewCount: sql`${recipes.viewCount} + ${count}` })
					.where(eq(recipes.id, recipeId));
			}
		});
	} finally {
		await db.$client.end();
	}

	// DB 反映に成功した分だけ KV を減算する。スナップショット取得後に届いた
	// 新しい閲覧を消さないよう、値を読み直してから確定した分だけ引く
	// （0 以下になったキーは削除し、次回の list() の対象から外す）。
	// ここでの取得〜書き込みの間に生じるレースは許容する（record-view.ts と
	// 同じ方針）。
	await Promise.all(
		increments.map(async ({ key, count }) => {
			const raw = await env.VIEW_COUNTS_KV.get(key);
			const current = raw ? Number.parseInt(raw, 10) : 0;
			const remaining = current - count;
			if (remaining > 0) {
				await env.VIEW_COUNTS_KV.put(key, String(remaining));
			} else {
				await env.VIEW_COUNTS_KV.delete(key);
			}
		}),
	);
}
