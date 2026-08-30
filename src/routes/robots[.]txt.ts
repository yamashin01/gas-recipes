import { createFileRoute } from "@tanstack/react-router";
import { CRAWLER_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";
import { siteOrigin } from "../lib/seo/site";
import { buildRobotsTxt } from "../lib/seo/sitemap";

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: ({ request }) => {
				const origin = siteOrigin() ?? new URL(request.url).origin;

				return new Response(buildRobotsTxt(origin), {
					headers: {
						"content-type": "text/plain; charset=utf-8",
						"cache-control": CRAWLER_CACHE_CONTROL,
					},
				});
			},
		},
	},
});
