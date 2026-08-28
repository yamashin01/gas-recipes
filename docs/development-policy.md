# GAS Recipe Hub 開発方針書

作成日：2026年8月28日

本書は [企画書](./proposal.md) を前提に、開発の進め方・運用ルールを定める。技術選定の背景や機能要件は企画書を正とし、本書では繰り返さない。

---

## 1. 技術スタック（確定）

| レイヤ | 技術 | 備考 |
|---|---|---|
| フレームワーク | TanStack Start（React / SSR + server functions） | 企画書 §4.2 |
| 実行環境 | Cloudflare Workers（Vite プラグイン経由） | `nodejs_compat` 必須 |
| DB | Neon Postgres（Free プラン） | Phase 1 は `@neondatabase/serverless`（HTTP）+ `drizzle-orm/neon-http`。Phase 2 で Hyperdrive + `node-postgres`（8.16.3+）へ切り替え。**併用しない**（企画書 §4.3） |
| ORM | Drizzle ORM + drizzle-kit | スキーマと型の一元管理 |
| 認証 | BetterAuth（Google OAuth） | セッションは Workers KV を `secondaryStorage` に指定（必須要件、企画書 §7.1） |
| ストレージ | R2（Phase 2：画像） / KV（セッション） | |
| バッチ | Cron Triggers（Phase 2：閲覧数集計） | |

## 2. ディレクトリ構成（案）

```
gas-recipes/
├─ src/
│  ├─ routes/              # ファイルベースルーティング（企画書 §6 の画面一覧に対応）
│  │  ├─ index.tsx         # トップ
│  │  ├─ recipes/          # 一覧・$slug 詳細
│  │  ├─ tags/$slug.tsx
│  │  ├─ search.tsx
│  │  ├─ admin/            # 管理画面（要認証）
│  │  └─ api/auth/$.ts     # BetterAuth ハンドラ
│  ├─ db/
│  │  ├─ schema.ts         # Drizzle スキーマ（企画書 §5）
│  │  └─ index.ts          # DB クライアント生成
│  ├─ lib/
│  │  └─ auth/             # BetterAuth 設定・ロール判定
│  ├─ components/          # UI コンポーネント
│  └─ styles/
├─ drizzle/                # drizzle-kit が生成するマイグレーション
├─ docs/
├─ wrangler.jsonc
├─ drizzle.config.ts       # 直接接続文字列を参照（§5 参照）
└─ vite.config.ts
```

構成は実装しながら最小限の範囲で調整してよいが、`routes / db / lib/auth` の分離は維持する。

## 3. ブランチ・PR 運用

- `main` を常にデプロイ可能な状態に保つ。`main` への直接 push はしない
- Issue 単位で `feature/<issue番号>-<短い名前>` ブランチを切り、PR で `main` にマージする
  - 例：`feature/12-drizzle-schema`
- PR 本文に `Closes #<issue番号>` を記載し、マージで Issue が自動クローズされるようにする
- PR テンプレート（`.github/PULL_REQUEST_TEMPLATE.md`）に沿って動作確認内容を記載する
- セルフマージ可（単独開発のため）。ただしチェックリストを満たしてからマージする

## 4. コミット規約

Conventional Commits に従う。

```
feat: レシピ詳細ページの SSR 実装
fix: タグ絞り込みのページング不具合を修正
docs: 開発方針書を追加
chore: drizzle-kit を 0.x.y へ更新
refactor: DB クライアント生成をミドルウェアへ移動
```

## 5. 環境変数・シークレット運用

| 用途 | ローカル | 本番 |
|---|---|---|
| Workers 実行時の秘密情報（DB 接続文字列、OAuth クレデンシャル、BetterAuth secret） | `.dev.vars`（gitignore 対象） | `wrangler secret put` |
| drizzle-kit（マイグレーション実行） | `.env` の `DATABASE_URL`（gitignore 対象）を `drizzle.config.ts` が参照 | ローカルから Neon へ直接実行 |

- BetterAuth CLI / drizzle-kit は Workers の DB バインディングに到達できないため、**マイグレーション系ツールは必ず直接接続文字列を使う別設定**とする（企画書 §11）
- `.dev.vars.example` をリポジトリに置き、必要な変数名を明示する（値は書かない）

## 6. 品質方針

- **TypeScript**: `strict: true`
- **Lint / Format**: Biome（ESLint + Prettier の代替として単一ツールで運用）
- **テスト**: Vitest。Phase 0 では設定のみ導入し、server functions・検索クエリなどロジック中心にユニットテストを追加していく。UI の E2E は当面スコープ外
- PR 前に `biome check` と `tsc --noEmit` を通すことをチェックリスト化する

## 7. デプロイ運用

- 当面は `wrangler deploy` による手動デプロイ（Phase 0 で Hello World デプロイまで確認）
- GitHub Actions による CI（lint / typecheck / test）は Phase 1 期間中に追加を検討する。CD（自動デプロイ）は運用が安定してから判断
- 独自ドメインはネームサーバーを Cloudflare へ移管して接続する（Phase 1d）

## 8. 設計上の遵守事項

企画書のリスク対策（§7.2・§11）から、実装全体で守るべき事項を抜き出す。

1. **auth / DB インスタンスはリクエストごとに1つ**：ミドルウェアチェーンの先頭で Drizzle インスタンスと BetterAuth インスタンスを生成し、下流で共有する。リクエスト内で複数生成しない（503・ハングの原因）
2. **Neon serverless driver と Hyperdrive を併用しない**：Phase 2 の切り替え時はドライバごと差し替える
3. **KV セッションキャッシュは必須**：BetterAuth の `secondaryStorage` 指定を省略しない（Neon コールドスタート対策）
4. **Neon のウォームアップ定期実行を設定しない**：Free プランの CU-hours を消費するため
5. **検索は pg_trgm から始める**：tsvector との併用拡張は精度不足が確認できてから（企画書 §5.2）
6. **Phase 1 のスコープを凍結**：追加要望は Issue 化して Phase 2 以降のバックログに積む

## 9. フェーズ計画と Issue 対応

作業はフェーズ単位の親 Issue とその配下のサブ Issue で管理する（ラベル `phase:*` / `type:*` を付与）。

| フェーズ | 親 Issue | サブ Issue（作業単位） | 目安 |
|---|---|---|---|
| Phase 0 | 環境構築 | プロジェクト雛形作成 ／ wrangler.jsonc 設定と Hello World デプロイ ／ Neon + Drizzle 接続確認・環境変数整理 | 1週目 |
| Phase 1a | スキーマ定義とマイグレーション基盤 | Drizzle スキーマ定義 ／ drizzle-kit 運用と Neon ブランチフロー確立 | 2週目 |
| Phase 1b | 認証（BetterAuth） | Google ソーシャルログイン ／ ロール制御と KV セッションキャッシュ | 3週目 |
| Phase 1c | レシピ CRUD・タグ・管理画面 | 公開ページ（一覧・詳細・タグ） ／ 管理画面 CRUD ／ スニペット管理とコピー UI | 4〜5週目 |
| Phase 1d | 検索・公開・ドメイン | pg_trgm 検索 ／ エッジキャッシュ・SEO・独自ドメイン | 6週目 |
| Phase 2 | 拡張機能 | コレクション ／ リビジョン + R2 ／ Cron 集計 ／ Hyperdrive 切り替え | 7週目以降 |

進行ルール：

- フェーズ内のサブ Issue がすべて完了したら親 Issue をクローズし、次フェーズへ進む
- Phase 0 の本番デプロイ確認を最優先とする（ローカルで動いて Workers で落ちる問題の早期発見。企画書 §8）
