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
- **Phase 2**：Hyperdrive ＋ `node-postgres`（8.16.3 以上）に**ドライバごと差し替え**

**両者は併用しない。** Neon の serverless driver は WebSocket / HTTP を使うため、TCP 前提の Hyperdrive のプーリングをバイパスしてしまい、併用しても効果が得られない。

## 3. 設計上の遵守事項

1. **auth / DB インスタンスはリクエストごとに1つ**：ミドルウェアチェーンの先頭で Drizzle インスタンスと BetterAuth インスタンスを生成し、下流で共有する。リクエスト内で複数生成しない（503・ハングの原因。企画書 §7.2）
2. **KV セッションキャッシュは必須**：BetterAuth の `secondaryStorage` 指定を省略しない（Neon コールドスタート対策。企画書 §7.1）
3. **Neon のウォームアップ定期実行を設定しない**：Free プランの CU-hours を消費するため
4. **検索は pg_trgm から始める**：tsvector との併用拡張は精度不足が確認できてから（企画書 §5.2）
5. **マイグレーション系ツールは直接接続文字列を使う**：drizzle-kit / BetterAuth CLI は Workers の DB バインディングに到達できないため、別設定で Neon へ直接接続する

## 4. デプロイ

- `wrangler deploy` による手動デプロイ（CI/CD は運用が安定してから検討）
- 独自ドメインはネームサーバーを Cloudflare へ移管して接続する（CNAME のみの設定は不可）
