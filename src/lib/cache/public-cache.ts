import { canonicalCacheKey, type PurgeTargets } from "./edge-cache-policy";

// Cache API へのアクセス。Workers ランタイム固有の import を持たないため、
// 管理画面の server function（クライアントバンドルにも取り込まれるモジュール）
// から安全に import できる（issue #18）。

export function cacheStorage(): Cache | undefined {
	// vitest（Node）やブラウザなど caches.default を持たない環境では何もしない
	if (typeof caches === "undefined" || !("default" in caches)) return undefined;
	// caches.default は Workers 固有で lib.dom の CacheStorage 型には無い
	return (caches as unknown as { default: Cache }).default;
}

/**
 * 公開ページのキャッシュを破棄する。制約が2つある（docs/architecture.md §4.1）。
 *
 * 1. Cache API の破棄は**このリクエストを処理しているコロのみ**に効く。他コロの
 *    コピーは s-maxage の期限切れで追随する（グローバルパージにはゾーンパージ
 *    API と API トークンの管理が必要なため、MVP では採用しない）
 * 2. キーが URL 完全一致のため、クエリ付きの派生 URL（`/recipes?page=2` など）は
 *    破棄できない。`page=1` と末尾スラッシュの揺れは canonicalCacheKey() で
 *    吸収しているため、1ページ目とタグページの主要 URL は破棄対象に入る
 */
export async function purgePublicCache(
	origin: string,
	targets: PurgeTargets = {},
): Promise<void> {
	const cache = cacheStorage();
	if (!cache) return;

	const paths = new Set<string>(["/", "/recipes", "/sitemap.xml"]);
	for (const slug of targets.recipeSlugs ?? []) {
		paths.add(`/recipes/${encodeURIComponent(slug)}`);
	}
	for (const slug of targets.tagSlugs ?? []) {
		paths.add(`/tags/${encodeURIComponent(slug)}`);
	}
	for (const slug of targets.collectionSlugs ?? []) {
		paths.add(`/collections/${encodeURIComponent(slug)}`);
	}
	for (const { recipeSlug, collectionSlug } of targets.recipeCollectionPairs ??
		[]) {
		paths.add(
			`/recipes/${encodeURIComponent(recipeSlug)}?collection=${encodeURIComponent(collectionSlug)}`,
		);
	}

	await Promise.all(
		Array.from(paths, (path) =>
			cache.delete(canonicalCacheKey(new URL(path, origin).toString())),
		),
	);
}

/**
 * 書き込み後のキャッシュ破棄。破棄先の origin は処理中のリクエストから取る
 * （context.request。src/start.ts のリクエストミドルウェアが載せている）。
 * 書き込み自体は成功しているため、破棄に失敗しても例外は投げずログに残す
 * だけにする（キャッシュは s-maxage の期限切れで追随する）。
 */
export async function purgeAfterWrite(
	request: Request,
	targets: PurgeTargets,
): Promise<void> {
	try {
		await purgePublicCache(new URL(request.url).origin, targets);
	} catch (error) {
		console.error("[cache] 公開ページのキャッシュ破棄に失敗しました", error);
	}
}
