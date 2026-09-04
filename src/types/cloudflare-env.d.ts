// wrangler.jsonc に定義のない Secret を Env 型に追加する。
// wrangler.jsonc に bindings を追加したときは `pnpm run cf-typegen` を再実行すること。
//
// DATABASE_URL はここには含めない。Workers 本体は Hyperdrive バインディング
// （env.HYPERDRIVE.connectionString）経由で接続するため Secret として持たず、
// drizzle-kit CLI 用の直接接続文字列としてのみ .env で管理する
// （docs/migration-flow.md、issue #22）。
declare namespace Cloudflare {
	interface Env {
		// BetterAuth（docs/proposal.md §7・§7.2）
		BETTER_AUTH_URL: string;
		BETTER_AUTH_SECRET: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
	}
}
