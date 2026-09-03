import { createFileRoute } from "@tanstack/react-router";
import { CRAWLER_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";
import { siteOrigin } from "../lib/seo/site";
import { buildSitemapXml, collectSitemapEntries } from "../lib/seo/sitemap";

// 公開ページのサイトマップ（issue #18）。VITE_SITE_URL が未設定の環境
// （ローカル・プレビュー）では実リクエストの origin を使う。
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async ({ request, context }) => {
				const origin = siteOrigin() ?? new URL(request.url).origin;
				const entries = await collectSitemapEntries(context.db);

				return new Response(buildSitemapXml(origin, entries), {
					headers: {
						"content-type": "application/xml; charset=utf-8",
						"cache-control": CRAWLER_CACHE_CONTROL,
					},
				});
			},
		},
	},
});
