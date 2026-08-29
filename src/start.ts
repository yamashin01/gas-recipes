import { env } from "cloudflare:workers";
import { createMiddleware, createStart } from "@tanstack/react-start";
import type { Db } from "./db/client";
import { createDb } from "./db/client";
import type { Auth } from "./lib/auth/auth";
import { createAuth } from "./lib/auth/auth";

export interface AppRequestContext {
	db: Db;
	auth: Auth;
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
	async ({ next }) => {
		const db = createDb(env.DATABASE_URL);
		const auth = createAuth(db, env.SESSION_KV, {
			baseURL: env.BETTER_AUTH_URL,
			secret: env.BETTER_AUTH_SECRET,
			googleClientId: env.GOOGLE_CLIENT_ID,
			googleClientSecret: env.GOOGLE_CLIENT_SECRET,
		});

		return next({ context: { db, auth } });
	},
);

export const startInstance = createStart(() => ({
	requestMiddleware: [authRequestMiddleware],
}));
