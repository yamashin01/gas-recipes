import type { PurgeTargets } from "./edge-cache-policy";

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
 * 公開ページのキャッシュを破棄する。Cache API はキーが URL 完全一致のため、
 * クエリ付きの派生 URL（`/recipes?page=2` など）は破棄できない。それらは
 * s-maxage の期限切れで追随する（docs/architecture.md §4）。
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

	await Promise.all(
		Array.from(paths, (path) => cache.delete(new URL(path, origin).toString())),
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
