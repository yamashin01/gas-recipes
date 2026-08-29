# マイグレーション運用フロー

作成日：2026年8月29日

drizzle-kit によるマイグレーション生成・適用の手順と、Neon のブランチ機能を使って
安全に試行するフローをまとめる（企画書 §4.2・§8、アーキテクチャ §2-3）。

## 1. 接続方式の前提

- drizzle-kit（`generate` / `migrate` / `studio`）は Cloudflare Workers の DB
  バインディングに到達できないため、Neon への **直接接続文字列** を使う
  （アーキテクチャ §3-5）。
- 直接接続文字列は `.env` の `DATABASE_URL` から読み込む（`drizzle.config.ts`）。
  `.env` は gitignore 対象。`.env.example` を元にローカルで作成する。
- Neon の接続文字列は「pooled」ではなく「直接接続（Direct connection）」を
  ダッシュボードの Connection Details から取得すること。pooled 接続（PgBouncer
  経由）は DDL を伴うマイグレーションと相性が悪いため使用しない。
- アプリ本体（Workers ランタイム）は `@neondatabase/serverless`（HTTP モード）
  を使い続ける。drizzle-kit 用の直接接続とは別経路であり、混同しない
  （企画書 §4.3）。
- drizzle-kit の CLI（`migrate` / `studio` 等）は、`pg` → `postgres` →
  `@vercel/postgres` → `@neondatabase/serverless` の順にインストール済み
  パッケージを自動検出してドライバを選ぶ。本プロジェクトの依存関係には
  `pg` しかないため（`@neondatabase/serverless` はアプリ用の依存だが CLI にも
  検出される）、CLI 操作用に **`pg`（node-postgres）を devDependencies に追加**
  している。`@neondatabase/serverless` 経由（WebSocket 接続）に自動フォール
  バックすると `'@neondatabase/serverless' can only connect to remote
  Neon/Vercel Postgres/Supabase instances through a websocket` という警告と
  ともに CLI から接続できないことがあるため、通常の TCP 接続で安定する `pg` を
  優先させている。

## 2. Neon ブランチを使った安全な適用フロー

スキーマ変更は必ず Neon の**開発ブランチ**で試行してから本体ブランチへ適用する。

```
1. Neon ダッシュボードで本体ブランチ（例：main）から開発ブランチを作成する
   例：dev/add-recipes-schema
2. 開発ブランチの Connection Details（直接接続）を .env の DATABASE_URL に設定する
3. src/db/schema.ts を変更する
4. pnpm db:generate でマイグレーション SQL を生成する（./drizzle 配下に出力）
   - この時点では DB に接続しない。スキーマファイルと直前のスナップショット
     （drizzle/meta）の差分から SQL を作るだけ
   - 生成された SQL を必ず目視確認する（意図しない DROP や型変更がないか）
5. pnpm db:migrate で開発ブランチに適用する
6. pnpm db:studio や実際のクエリで、開発ブランチ上の変更を検証する
7. 問題なければ .env の DATABASE_URL を本体ブランチの直接接続に切り替え、
   同じマイグレーション（drizzle/ 配下、手順4で生成済みのファイル）を
   pnpm db:migrate で本体ブランチへ適用する
8. 開発ブランチは役目を終えたら Neon ダッシュボードから削除する
```

ポイント：**マイグレーション SQL は開発ブランチ用と本体ブランチ用で作り直さない**。
手順4で生成した同一のファイルを、接続先（`DATABASE_URL`）を切り替えて2回
（開発ブランチ→本体ブランチ）適用する。これにより「開発ブランチでは通ったが
本体では失敗する」というズレを防ぐ。

## 3. コマンド一覧

| コマンド | 用途 | DB 接続 |
|---|---|---|
| `pnpm db:generate` | スキーマ差分からマイグレーション SQL を生成 | 不要 |
| `pnpm db:migrate` | 未適用のマイグレーションを `DATABASE_URL` 先に適用 | 必要 |
| `pnpm db:studio` | Drizzle Studio で接続先 DB の中身を確認 | 必要 |

## 4. BetterAuth CLI との関係（Phase 1b 向けメモ）

BetterAuth の CLI（`npx @better-auth/cli generate` 等）も、drizzle-kit と同様に
Workers の DB バインディングには到達できない。Phase 1b で BetterAuth を導入する
際は、drizzle-kit と同じ直接接続文字列（`.env` の `DATABASE_URL`）を指す設定を
別途用意し、同じ Neon ブランチフロー（本節 §2）に乗せる（企画書 §11 リスク表）。

BetterAuth CLI が生成する `user` / `session` / `account` / `verification` の
実スキーマが確定した時点で、`src/db/schema.ts` 内の `user` プレースホルダー
（Phase 1a で `author_id` の FK 整合のためだけに定義したもの）を置き換える。

## 5. 現状（Phase 1a 実施記録）

- `src/db/schema.ts` に `recipes` / `code_snippets` / `tags` / `recipe_tags` と
  `user` プレースホルダーを定義した。
- `pnpm db:generate` により初回マイグレーション `drizzle/0000_wide_vulcan.sql`
  を生成済み（DB 接続なしで生成できることを確認済み）。
- `pnpm db:migrate` を `@neondatabase/serverless` 経由（WebSocket）で実行すると
  接続に失敗する事象を確認したため、CLI 用に `pg` を追加し、`pg` ドライバで
  実行されるようにした（本節 §1）。
- **本節 §2 の手順5〜7（開発ブランチ→本体ブランチへの適用）を実践済み。**
  開発ブランチに 5 テーブルが作成されたことを確認したのち、同一のマイグレー
  ション（`drizzle/0000_wide_vulcan.sql`）を本体ブランチにも適用した。これに
  より「スキーマ変更 → ブランチで試行 → 本体適用」の一連の流れを1回実践し、
  ドキュメント化した（Issue #11 の完了条件を満たす）。
