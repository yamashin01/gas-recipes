import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { createKvSecondaryStorage } from "./kv-secondary-storage";

export interface AuthEnv {
	baseURL: string;
	secret: string;
	googleClientId: string;
	googleClientSecret: string;
}

// リクエストごとに1つだけ生成し、ミドルウェアチェーンの先頭で下流に共有する
// （docs/architecture.md §3-1）。Workers では DB / KV バインディングがリクエスト
// ハンドラ内でしか取得できないため、モジュールトップレベルでは初期化できない。
export function createAuth(db: Db, kv: KVNamespace, env: AuthEnv) {
	return betterAuth({
		baseURL: env.baseURL,
		secret: env.secret,
		database: drizzleAdapter(db, {
			provider: "pg",
			schema,
		}),
		// Neon のコールドスタート対策として必須（docs/proposal.md §7.1）。
		// secondaryStorage を指定すると、セッションの読み取りは KV 経由になる
		// （storeSessionInDatabase のデフォルトは false のため DB へは書き込まれない）。
		secondaryStorage: createKvSecondaryStorage(kv),
		socialProviders: {
			google: {
				clientId: env.googleClientId,
				clientSecret: env.googleClientSecret,
			},
		},
		plugins: [
			// admin: 書き込み可 / user: 閲覧のみ（docs/proposal.md §7）
			admin({
				defaultRole: "user",
				adminRoles: ["admin"],
			}),
			// TanStack Start の server functions でも Set-Cookie が反映されるようにする。
			// 他のプラグインより後ろに置く必要がある（プラグイン自身の警告に従う）。
			tanstackStartCookies(),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
