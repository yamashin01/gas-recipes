import { env } from "cloudflare:workers";
import { createMiddleware, createStart } from "@tanstack/react-start";
import type { Db } from "./db/client";
import { createDb } from "./db/client";
import type { Auth } from "./lib/auth/auth";
import { createAuth } from "./lib/auth/auth";
import { withEdgeCache } from "./lib/cache/edge-cache";

export interface AppRequestContext {
	db: Db;
	auth: Auth;
	// server function からリクエスト情報（Cookie ヘッダ・origin）を参照するため
	// context に載せる。@tanstack/react-start/server の getRequest() は
	// サーバー専用 import で、クライアントバンドルに含まれるモジュールからは
	// 使えないため（issue #18）。
	request: Request;
}

// server functions・server routes の context に AppRequestContext の型を
// 反映させるための Register 拡張（authRequestMiddleware が実際に埋め込む値）。
declare module "@tanstack/react-router" {
	interface Register {
		server: {
			requestContext: AppRequestContext;
		};
	}
}

// グローバルリクエストミドルウェア。Drizzle / BetterAuth インスタンスを
// リクエストごとに1つだけ生成し、下流（server functions・server routes）に
// context 経由で共有する（docs/architecture.md §3-1）。Workers では DB / KV
// バインディングがリクエストハンドラ内でしか取得できないため、
// モジュールトップレベルでは初期化できない。
const authRequestMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
		const db = createDb(env.DATABASE_URL);
		const auth = createAuth(db, env.SESSION_KV, {
			baseURL: env.BETTER_AUTH_URL,
			secret: env.BETTER_AUTH_SECRET,
			googleClientId: env.GOOGLE_CLIENT_ID,
			googleClientSecret: env.GOOGLE_CLIENT_SECRET,
		});

		return next({ context: { db, auth, request } });
	},
);

// 公開ページのエッジキャッシュ（issue #18）。認証・DB インスタンスの生成より
// 前に置き、キャッシュヒット時は下流（＝ローダー、ひいては Neon）へ到達させない
// （docs/architecture.md §4）。
const edgeCacheMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) =>
		withEdgeCache(request, async () => (await next()).response),
);

export const startInstance = createStart(() => ({
	requestMiddleware: [edgeCacheMiddleware, authRequestMiddleware],
}));
