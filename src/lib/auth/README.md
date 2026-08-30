# auth

BetterAuth による Google ソーシャルログインと admin/user ロール制御（Phase 1b、`docs/proposal.md` §7）。

## 構成

- `auth.ts`：`createAuth(db, kv, env)` — BetterAuth インスタンスのファクトリ。リクエストごとに `src/start.ts` のグローバルミドルウェアが1つだけ生成し、下流に共有する（`docs/architecture.md` §3-1）
- `kv-secondary-storage.ts`：BetterAuth の `secondaryStorage` を Workers KV で実装（Neon コールドスタート対策、`docs/proposal.md` §7.1）
- `get-session.ts`：セッション取得用の server function。route の `beforeLoad` から SSR / クライアントサイド遷移のどちらでも同じ形で呼び出せる
- `require-admin.ts`：`/admin` 配下で使う admin ロールガード（issue #13）

`/api/auth/*` ハンドラは `src/routes/api.auth.$.ts` にある。

## ローカルセットアップ

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) で OAuth 2.0 クライアント ID を作成する
   - 承認済みのリダイレクト URI：`http://localhost:3000/api/auth/callback/google`
2. `.dev.vars.example` を `.dev.vars` にコピーし、`DATABASE_URL` に加えて次を設定する
   - `BETTER_AUTH_SECRET`（`openssl rand -base64 32` 等で生成）
   - `BETTER_AUTH_URL`（ローカルは `http://localhost:3000`）
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
3. Workers KV の SESSION_KV を作成し、`wrangler.jsonc` の `kv_namespaces[0].id` を実際の id に置き換える
   ```sh
   pnpm wrangler kv namespace create SESSION_KV
   ```
4. マイグレーションを適用する（`drizzle/` 配下に BetterAuth のコアスキーマ + admin プラグイン拡張を含めて生成済み）
   ```sh
   pnpm run db:migrate
   ```

## 本番セットアップ

- Google OAuth クライアントに本番ドメインのリダイレクト URI（`https://<domain>/api/auth/callback/google`）を追加する
- 以下をすべて `wrangler secret put <NAME>` で設定する（`BETTER_AUTH_URL` もシークレット扱いにする。Workers の `vars` は `wrangler.jsonc` に平文でコミットされるため、ドメイン変更のたびに差分を出したくない場合はこちらの方が扱いやすい）
  ```sh
  pnpm wrangler secret put DATABASE_URL
  pnpm wrangler secret put BETTER_AUTH_SECRET
  pnpm wrangler secret put BETTER_AUTH_URL   # 例: https://gas-recipes.<subdomain>.workers.dev
  pnpm wrangler secret put GOOGLE_CLIENT_ID
  pnpm wrangler secret put GOOGLE_CLIENT_SECRET
  ```
- 本番 DB にもマイグレーションを適用する（`.env` の `DATABASE_URL` を一時的に本番の接続文字列に切り替えて `pnpm run db:migrate` を実行し、終わったら元に戻す）
- 自分のアカウントに admin ロールを付与する（初回のみ、Neon 上で直接 `update "user" set role = 'admin' where email = '<自分の email>'` を実行する）
