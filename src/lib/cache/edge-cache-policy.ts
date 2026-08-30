// エッジキャッシュの対象判定と Cache-Control の値（issue #18）。
// Workers ランタイム API に依存しない純粋なロジックとして切り出し、
// ユニットテストの対象にする（実際の読み書きは edge-cache.ts）。

/**
 * 公開ページの Cache-Control。
 * - `max-age=0`：ブラウザには保持させない（更新が即座に反映されるように）
 * - `s-maxage`：エッジ（Cache API）での保持時間。管理画面からの更新時は
 *   purgePublicCache() で明示的に破棄するため、長めに取っても陳腐化しない
 */
export const PUBLIC_CACHE_CONTROL =
	"public, max-age=0, s-maxage=300, stale-while-revalidate=600";
/** sitemap.xml / robots.txt はクローラ向けで更新頻度が低い */
export const CRAWLER_CACHE_CONTROL = "public, max-age=0, s-maxage=3600";
/** 検索結果はクエリごとに URL が増えるため短命にする */
export const SEARCH_CACHE_CONTROL = "public, max-age=0, s-maxage=60";

const EXACT_PATHS = new Set([
	"/",
	"/recipes",
	"/search",
	"/sitemap.xml",
	"/robots.txt",
]);
const PREFIXES = ["/recipes/", "/tags/"];

/** パスがエッジキャッシュ対象の公開ページかどうか。 */
export function isCacheablePath(pathname: string): boolean {
	// 末尾スラッシュの揺れを吸収する（/recipes/ と /recipes を同一視）
	const path =
		pathname.length > 1 && pathname.endsWith("/")
			? pathname.slice(0, -1)
			: pathname;

	if (EXACT_PATHS.has(path)) return true;
	return PREFIXES.some(
		(prefix) => path.startsWith(prefix) && path.length > prefix.length,
	);
}

/**
 * キャッシュキーに使う正規化済み URL を返す。
 *
 * 同じ内容のページが別キーで積まれると、書き込み後の破棄が取りこぼす。
 * アプリ内の <Link> は1ページ目でも `page=1` を URL に載せるため、
 * `/recipes` と `/recipes?page=1` は同一視する必要がある（PR #30 レビュー指摘）。
 * - 末尾スラッシュを落とす（ルートは除く）
 * - `page=1` と空の値のクエリを落とす
 */
export function canonicalCacheKey(url: string): string {
	const parsed = new URL(url);

	if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
		parsed.pathname = parsed.pathname.replace(/\/+$/, "");
	}

	const dropped = Array.from(parsed.searchParams.entries())
		.filter(([key, value]) => value === "" || (key === "page" && value === "1"))
		.map(([key]) => key);
	for (const key of dropped) {
		parsed.searchParams.delete(key);
	}

	return parsed.toString();
}

/**
 * キャッシュを引く／保存する対象のリクエストかどうか。
 * HTML ドキュメントの GET のみを対象にし、server function への RPC や
 * 管理画面・認証まわりは対象外にする。
 */
export function isCacheableRequest(request: {
	method: string;
	url: string;
	headers: { get(name: string): string | null };
}): boolean {
	if (request.method !== "GET") return false;

	const { pathname } = new URL(request.url);
	if (!isCacheablePath(pathname)) return false;

	// 認証済みかどうかで内容が変わるページは無い（ログイン状態はクライアント側で
	// 取得している）が、Cookie 付きレスポンスを共有しないよう保存側で弾く。
	const accept = request.headers.get("accept") ?? "";
	// robots.txt / sitemap.xml はクローラが Accept: */* で取りに来る
	if (pathname === "/robots.txt" || pathname === "/sitemap.xml") return true;
	return accept.includes("text/html");
}

/** レスポンスをキャッシュに保存してよいか。 */
export function isStorableResponse(response: {
	status: number;
	headers: { get(name: string): string | null };
}): boolean {
	if (response.status !== 200) return false;
	// Set-Cookie を含むレスポンスは共有すると別人のセッションを配ってしまう。
	// Cache API 側でも例外になるため、ここで弾く。
	if (response.headers.get("set-cookie")) return false;

	const cacheControl = response.headers.get("cache-control") ?? "";
	if (/no-store|private/i.test(cacheControl)) return false;
	// s-maxage / max-age が無いレスポンスは保存期間が決まらないため保存しない
	return /s-maxage=|max-age=[1-9]/i.test(cacheControl);
}

export interface PurgeTargets {
	/** 更新・削除されたレシピの slug（旧 slug も含める） */
	recipeSlugs?: string[];
	/** 影響するタグの slug */
	tagSlugs?: string[];
}
