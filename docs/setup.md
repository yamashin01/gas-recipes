# 初期セットアップ手順（Phase 0）

TanStack Start + Cloudflare Workers + Neon + Drizzle の開発基盤を構築する手順。企画書付録（`docs/proposal.md`）のチェックリストに対応する。

## 1. リポジトリの取得と依存関係のインストール

```
git clone https://github.com/yamashin01/gas-recipes.git
cd gas-recipes
pnpm install
```

## 2. Cloudflare の設定

1. Cloudflareアカウントを用意する（https://dash.cloudflare.com/sign-up）
2. ダッシュボード → Workers & Pages → 右側の「Your subdomain」で `workers.dev` サブドメインを設定する（初回のみ）
3. ローカルで認証する
   ```
   pnpm exec wrangler login
   pnpm exec wrangler whoami
   ```

CI/CDでの自動デプロイは行わず、`wrangler deploy` による手動デプロイを採用している（`docs/architecture.md` §4）。

## 3. Neon の設定

1. https://console.neon.tech でプロジェクトを作成する（Free プラン）
2. 開発用ブランチを作成する（コンソールの「Branches」→「Create branch」。例：`dev`）。Neonのブランチ機能を使うことで、スキーマ変更を安全に試せる
3. プロジェクトの「Connect」画面から接続文字列を2種類控える
   - **Pooled connection string**：アプリの実行時クエリ用（`@neondatabase/serverless` のHTTPモード）
   - **Direct connection string**：`drizzle-kit` のマイグレーション用（poolerだとDDL実行で問題が出ることがあるため）

## 4. 環境変数の設定

用途によって読み込まれる場所が異なるため注意する。

| ファイル | 読み込み元 | 入れる接続文字列 |
|---|---|---|
| `.env`（`.env.example` からコピー） | `drizzle-kit`（`db:generate` / `db:migrate` / `db:studio`） | Direct connection string |
| `.dev.vars`（`.dev.vars.example` からコピー） | `wrangler dev` / `vite dev`（ローカルのWorkers実行環境） | Pooled connection string |

```
cp .env.example .env
cp .dev.vars.example .dev.vars
# それぞれの DATABASE_URL= の後ろに接続文字列を貼り付ける
```

どちらも `.gitignore` 対象でコミットされない。

本番（デプロイ後のWorker）にはシークレットとして登録する。

```
pnpm exec wrangler secret put DATABASE_URL
# プロンプトには Pooled connection string を貼り付ける
```

## 5. デプロイと動作確認

```
pnpm run deploy
```

`vite build && wrangler deploy` を実行する。初回は `wrangler.jsonc` の `name` を元に Worker が新規作成される。デプロイ後に表示される `https://gas-recipes.<your-subdomain>.workers.dev` にアクセスし、トップページが表示されることを確認する。

### Neon 接続確認

`/api/health` にアクセスすると、Drizzle（`drizzle-orm/neon-http`）経由で Neon に `select 1` を実行し、結果を返す。

```
curl https://gas-recipes.<your-subdomain>.workers.dev/api/health
# 成功時: {"status":"ok"}
# 失敗時: {"status":"error","message":"..."} （HTTP 500）
```

ローカルでも `pnpm run dev` → `curl http://localhost:3000/api/health` で同様に確認できる（`.dev.vars` の設定が必要）。

スキーマ未定義の段階での接続確認だけであれば、`pnpm run db:studio`（`.env` の Direct connection string を使用）でも代用できる。

## 6. Cloudflare の型生成（bindings を追加したとき）

`wrangler.jsonc` に bindings（KV / R2 など）を追加した場合は、型定義を再生成する。

```
pnpm run cf-typegen
```

`worker-configuration.d.ts` が更新される（コミット対象）。Secret（`DATABASE_URL` など）は `wrangler.jsonc` に書かないため自動生成の対象外で、`src/types/cloudflare-env.d.ts` で手動拡張している。

## 7. 開発時によく使うコマンド

| コマンド | 内容 |
|---|---|
| `pnpm run dev` | ローカル開発サーバー起動（`vite dev`、Workersランタイムをローカルでエミュレート） |
| `pnpm run check` | Biome によるLint/Format確認 |
| `pnpm run typecheck` | `tsc --noEmit` |
| `pnpm run test` | Vitest によるユニットテスト |
| `pnpm run build` | 本番ビルド |
| `pnpm run deploy` | ビルド＋`wrangler deploy` |
| `pnpm run db:generate` / `db:migrate` | drizzle-kit によるマイグレーション生成・適用 |
| `pnpm run db:studio` | Drizzle Studio（DB内容の確認・接続確認） |

## 8. 依存パッケージの更新に関する注意

`pnpm install` 時に pnpm の `minimumReleaseAge` ポリシー（公開直後のパッケージを拒否するサプライチェーン対策）を有効にしている環境では、公開されたばかりのバージョンの依存を弾かれることがある。本リポジトリでは `wrangler` / `@cloudflare/vite-plugin` を直接指定し、間接依存の `zod` / `electron-to-chromium` は `pnpm-workspace.yaml` の `overrides` で明示的に少し前のバージョンへ固定している。依存を更新する際は、更新後のバージョンの公開日が新しすぎないか確認するとよい。
