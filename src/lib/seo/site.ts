// canonical・OGP・sitemap で使う絶対 URL とメタタグの組み立て（issue #18）。
//
// head() はサーバーでもクライアントでも実行されるため、origin は Workers の
// env ではなくビルド時に埋め込まれる VITE_SITE_URL から取る。未設定のときは
// 誤った絶対 URL を出すより何も出さない方が安全なので、canonical・og:url を
// 省略する（サーバールートでは実リクエストの origin をフォールバックに使う）。

export const SITE_NAME = "GAS Recipe Hub";
export const SITE_DESCRIPTION =
	"GAS（Google Apps Script）の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース。";

/** ビルド時に設定された公開サイトの origin。末尾スラッシュは除去する。 */
export function siteOrigin(): string | undefined {
	return normalizeOrigin(import.meta.env.VITE_SITE_URL);
}

export function normalizeOrigin(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\/+$/, "");
}

/** origin が分かっているときだけ絶対 URL を返す。 */
export function absoluteUrl(
	path: string,
	origin = siteOrigin(),
): string | undefined {
	if (!origin) return undefined;
	return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * canonical 用のパスを組み立てる。undefined の値と `page=1` は省き、同じ内容の
 * ページが別 URL として重複しないようにする。
 */
export function pathWithQuery(
	path: string,
	params: Record<string, string | number | undefined> = {},
): string {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === "") continue;
		if (key === "page" && Number(value) === 1) continue;
		query.set(key, String(value));
	}
	const search = query.toString();
	return search ? `${path}?${search}` : path;
}

export interface SeoOptions {
	/** <title> と og:title。サイト名は呼び出し側で付ける */
	title: string;
	description?: string;
	/** canonical に使うパス（クエリを含めない正規化済みのもの） */
	path: string;
	/** 記事ページは "article"、それ以外は "website" */
	type?: "website" | "article";
	/** 検索結果のような重複コンテンツを検索エンジンに登録させない */
	noindex?: boolean;
	origin?: string;
}

/** ルートの head() にそのまま渡せる meta / links を組み立てる。 */
export function seo({
	title,
	description,
	path,
	type = "website",
	noindex = false,
	origin = siteOrigin(),
}: SeoOptions) {
	const url = absoluteUrl(path, origin);

	const meta: Array<Record<string, string>> = [
		{ title },
		{ property: "og:title", content: title },
		{ property: "og:type", content: type },
		{ property: "og:site_name", content: SITE_NAME },
		{ name: "twitter:card", content: "summary" },
	];

	if (description) {
		meta.push({ name: "description", content: description });
		meta.push({ property: "og:description", content: description });
	}
	if (url) {
		meta.push({ property: "og:url", content: url });
	}
	if (noindex) {
		meta.push({ name: "robots", content: "noindex, follow" });
	}

	return {
		meta,
		links: url ? [{ rel: "canonical", href: url }] : [],
	};
}
