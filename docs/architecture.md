# アーキテクチャ

作成日：2026年8月28日

技術構成と、実装全体で守るべき設計上の制約をまとめる。選定理由の詳細は[企画書](./proposal.md) §4 を参照。

## 1. 技術スタック

| レイヤ | 技術 | 備考 |
|---|---|---|
| フレームワーク | TanStack Start（React / SSR + server functions） | |
| 実行環境 | Cloudflare Workers（Vite プラグイン経由） | `nodejs_compat` 必須 |
| DB | Neon Postgres（Free プラン） | 接続方式は §2 |
| ORM | Drizzle ORM + drizzle-kit | |
| 認証 | BetterAuth（Google OAuth、admin/user ロール） | セッションは Workers KV にキャッシュ |
| ストレージ | Workers KV（セッション） / R2（画像、Phase 2） | |
| バッチ | Cron Triggers（閲覧数集計、Phase 2） | |

## 2. DB 接続方式

段階的に切り替える（企画書 §4.3）。

- **Phase 1**：`@neondatabase/serverless`（HTTP）＋ `drizzle-orm/neon-http`
- **Phase 2（切り替え済み）**：Hyperdrive ＋ `node-postgres`（`pg`、8.16.3 以上）に**ドライバごと差し替え**

**両者は併用しない。** Neon の serverless driver は WebSocket / HTTP を使うため、TCP 前提の Hyperdrive のプーリングをバイパスしてしまい、併用しても効果が得られない（`@neondatabase/serverless` は依存関係からも削除済み）。

切り替えに伴う変更点：

- `src/db/client.ts` の `createDb()` は `env.HYPERDRIVE.connectionString`（Hyperdrive が発行するプール接続文字列）を受け取る。drizzle-kit CLI は引き続き Neon への直接接続文字列（`.env` の `DATABASE_URL`）を使う（Hyperdrive を経由できないため。§3-5）
- `node-postgres` は本物の TCP セッションを持つため `db.transaction()` が使える。neon-http（HTTP 経由で `db.transaction()` 非対応）のために使っていた `db.batch()` は全箇所を `db.transaction()` に置き換えた
- Workers のリクエストごとに `Pool` を作成し、リクエスト終了時に `waitUntil(db.$client.end())` で閉じる（Cloudflare の Hyperdrive + node-postgres 推奨パターン。プール自体の再利用は Hyperdrive 側が担う）
- 切り替え前後の効果測定は [docs/hyperdrive-migration.md](./hyperdrive-migration.md) を参照（企画書 §12 の学習面の完了定義）

## 3. 設計上の遵守事項

1. **auth / DB インスタンスはリクエストごとに1つ**：ミドルウェアチェーンの先頭で Drizzle インスタンスと BetterAuth インスタンスを生成し、下流で共有する。リクエスト内で複数生成しない（503・ハングの原因。企画書 §7.2）
2. **KV セッションキャッシュは必須**：BetterAuth の `secondaryStorage` 指定を省略しない（Neon コールドスタート対策。企画書 §7.1）
3. **Neon のウォームアップ定期実行を設定しない**：Free プランの CU-hours を消費するため
4. **検索は pg_trgm から始める**：tsvector との併用拡張は精度不足が確認できてから（企画書 §5.2）
5. **マイグレーション系ツールは直接接続文字列を使う**：drizzle-kit / BetterAuth CLI は Workers の DB バインディングに到達できないため、別設定で Neon へ直接接続する

## 4. デプロイ・公開

- `wrangler deploy` による手動デプロイ（CI/CD は運用が安定してから検討）
- 独自ドメインはネームサーバーを Cloudflare へ移管して接続する（CNAME のみの設定は不可）
- `VITE_SITE_URL` に公開サイトの origin を設定してからビルドする。canonical・
  OGP・sitemap.xml の絶対 URL に使う（未設定時は canonical と og:url を出さず、
  sitemap.xml / robots.txt はリクエストの origin にフォールバックする）

### 4.1 エッジキャッシュ

Workers のルートに来たリクエストは Worker が先に受けるため、レスポンスを
返すだけではエッジに載らない。公開ページは **Cache API（`caches.default`）を
明示的に読み書きする**（`src/lib/cache/`）。

- 対象：`/`・`/recipes`・`/recipes/$slug`・`/tags/$slug`・`/search`・
  `sitemap.xml`・`robots.txt` への GET（HTML ドキュメント）。管理画面・
  認証エンドポイント・server function への RPC は対象外
- キャッシュキーは URL をそのまま使わず、末尾スラッシュと `page=1` を落とした
  正規形にする。アプリ内の `<Link>` は1ページ目でも `page=1` を URL に載せる
  ため、正規化しないと同じ内容が別キーで積まれて破棄が取りこぼす
- 保持時間はレスポンスの `Cache-Control` に従う（公開ページ `s-maxage=300`、
  クローラ向けファイル `s-maxage=3600`、検索結果 `s-maxage=60`）。各ルートの
  `headers()` で指定する
- `Set-Cookie` を含むレスポンスと 200 以外は保存しない
- ヒット/ミスは `x-edge-cache` レスポンスヘッダで確認できる
- ログイン状態はクライアント側で取得しており SSR の HTML に含まれないため、
  認証状態によらず同じレスポンスを共有してよい

**無効化**：管理画面からレシピ・スニペットを作成／更新／削除したときに、
トップ・一覧・該当レシピ詳細・関連タグページ・sitemap.xml のキャッシュを
破棄する。ただし整合性は次の2点で限定的であり、**グローバルな即時反映は
保証しない**。運用上は `s-maxage`（最大5分）が実質的な反映上限になる。

- Cache API の破棄は**その書き込みリクエストを処理したコロのみ**に効く。他の
  コロに載ったコピーは `s-maxage` の期限切れで追随する。全世界で即時に消すには
  ゾーンパージ API（API トークンの管理が必要）が要るため、MVP では採用しない
- キーが URL 完全一致のため、`?page=2` のようなクエリ付きの派生 URL は破棄
  できない（`page=1` と末尾スラッシュの揺れは正規化で吸収済み）

### 4.2 検索

`pg_trgm` のトライグラム索引（`gin_trgm_ops`）で、タイトル・要約・本文・
コードを対象に検索する（`src/lib/recipes/search.ts`）。日本語は部分一致
（`ILIKE`）、表記ゆれは類似度演算子 `%` で拾う。`%` は短いテキスト向けの
指標のため、タイトル・要約にのみ適用する。
