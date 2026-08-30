import { waitUntil } from "cloudflare:workers";
import { isCacheableRequest, isStorableResponse } from "./edge-cache-policy";
import { cacheStorage } from "./public-cache";

// Cloudflare の Cache API による公開ページのエッジキャッシュ（issue #18）。
//
// Workers のルートに来たリクエストは Worker が先に受けるため、レスポンスは
// 放っておいてもエッジには載らない。キャッシュヒット時に Neon へ到達させない
// ためには、この Cache API を明示的に読み書きする必要がある
// （docs/architecture.md §4）。
//
// 保持時間はレスポンスの Cache-Control（s-maxage）に従う。管理画面からの
// 更新時は purgePublicCache() で該当 URL を明示的に破棄する。

/** キャッシュヒットかどうかを動作確認できるようにするレスポンスヘッダ。 */
export const EDGE_CACHE_HEADER = "x-edge-cache";

/**
 * 対象リクエストならキャッシュを引き、無ければ handler の結果を保存する。
 * ヒット時は handler を呼ばないため、Neon へのクエリも発生しない。
 */
export async function withEdgeCache(
	request: Request,
	handler: () => Promise<Response>,
): Promise<Response> {
	const cache = cacheStorage();
	if (!cache || !isCacheableRequest(request)) {
		return handler();
	}

	const cached = await cache.match(request);
	if (cached) {
		const response = new Response(cached.body, cached);
		response.headers.set(EDGE_CACHE_HEADER, "HIT");
		return response;
	}

	const response = await handler();
	if (isStorableResponse(response)) {
		// レスポンス本体は呼び出し元へ返すため、複製の方をキャッシュへ書く
		waitUntil(cache.put(request, response.clone()));
		response.headers.set(EDGE_CACHE_HEADER, "MISS");
	}
	return response;
}
