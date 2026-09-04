import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { IMAGE_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";

// レシピ本文に埋め込んだ画像の配信ルート（issue #20）。R2 バケットを直接
// 公開せず Worker 経由で配信することで、バケット公開設定に依存しない。
export const Route = createFileRoute("/images/$key")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const object = await env.RECIPE_IMAGES.get(params.key);
				if (!object) {
					return new Response("Not Found", { status: 404 });
				}

				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set("etag", object.httpEtag);
				headers.set("cache-control", IMAGE_CACHE_CONTROL);

				return new Response(object.body, { headers });
			},
		},
	},
});
