# マイグレーション運用フロー

drizzle-kit によるマイグレーション適用と、Neon のブランチ機能を使った安全な
試行フローの手順書（企画書 §4.2・§8、アーキテクチャ §2-3）。

## 前提

- drizzle-kit は Workers の DB バインディングに到達できないため、`.env` の
  `DATABASE_URL`（Neon の**直接接続文字列**。pooledは不可）を直接使う
  （アーキテクチャ §3-5）。`.env.example` を元にローカルで作成する。
- アプリ本体（Workers）は `@neondatabase/serverless` の HTTP モードを使う。
  drizzle-kit 用の直接接続とは別経路。
- drizzle-kit CLI 用に `pg`（node-postgres）を devDependencies に追加している。
  無いと `@neondatabase/serverless`（WebSocket）にフォールバックし、
  `pnpm db:migrate` が接続失敗することがあるため。

## 適用手順

1. Neon ダッシュボードで本体ブランチから**開発ブランチ**を作成する
2. 開発ブランチの直接接続文字列を `.env` の `DATABASE_URL` に設定する
3. `src/db/schema.ts` を変更する
4. `pnpm db:generate` でマイグレーション SQL を生成し、内容を確認する
5. `pnpm db:migrate` で開発ブランチに適用し、`pnpm db:studio` 等で検証する
6. 問題なければ `.env` を本体ブランチの直接接続文字列に切り替え、**同じ
   マイグレーションファイル**を `pnpm db:migrate` で本体ブランチへ適用する
7. 開発ブランチを Neon ダッシュボードから削除する

開発ブランチ用と本体ブランチ用でマイグレーションファイルを作り直さない
（同一ファイルを接続先だけ変えて2回適用する）。

## コマンド

| コマンド | 用途 | DB 接続 |
|---|---|---|
| `pnpm db:generate` | スキーマ差分からマイグレーション SQL を生成 | 不要 |
| `pnpm db:migrate` | 未適用のマイグレーションを適用 | 必要 |
| `pnpm db:studio` | Drizzle Studio で接続先 DB を確認 | 必要 |

## Phase 1b（BetterAuth）向けメモ

BetterAuth CLI も同様に直接接続文字列が必要になる。`src/db/schema.ts` の
`user` は Phase 1a 用の最小プレースホルダーなので、BetterAuth CLI が生成する
実スキーマに置き換える。

## Phase 1d（検索）向けメモ

`0004_search_pg_trgm.sql` は先頭で `CREATE EXTENSION IF NOT EXISTS pg_trgm`
を実行してから `gin_trgm_ops` の索引を作る。拡張の作成には所有者権限が必要な
ため、Neon の**オーナーロール**の接続文字列で `pnpm db:migrate` を実行する。

## 実施記録

- 2026-08-29：初回マイグレーション（recipes / code_snippets / tags /
  recipe_tags / user）を開発ブランチ→本体ブランチの順に適用済み（PR #25）。
