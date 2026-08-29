// wrangler.jsonc に定義のない Secret（DATABASE_URL 等）を Env 型に追加する。
// wrangler.jsonc に bindings を追加したときは `pnpm run cf-typegen` を再実行すること。
declare namespace Cloudflare {
	interface Env {
		DATABASE_URL: string;
		// BetterAuth（docs/proposal.md §7・§7.2）
		BETTER_AUTH_URL: string;
		BETTER_AUTH_SECRET: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
	}
}
