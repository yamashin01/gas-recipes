# CLAUDE.md

GAS（Google Apps Script）の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース（GAS Recipe Hub）。

- 機能要件・技術選定の理由 → [docs/proposal.md](./docs/proposal.md)
- 技術構成・設計上の制約 → [docs/architecture.md](./docs/architecture.md)
- フェーズ・タスク管理 → GitHub Issues（フェーズ単位の親イシュー #1〜#6 とそのサブイシュー）

## ブランチ・PR 運用

- `main` を常にデプロイ可能な状態に保つ。`main` への直接 push はしない
- Issue 単位で `feature/<issue番号>-<短い名前>` ブランチを切り、PR で `main` にマージする
  - 例：`feature/10-drizzle-schema`
- PR 本文に `Closes #<issue番号>` を記載し、マージで Issue が自動クローズされるようにする
- PR テンプレートに沿って動作確認内容を記載する
- セルフマージ可（単独開発のため）。ただしチェックリストを満たしてからマージする

## コミット規約

Conventional Commits に従う（feat / fix / docs / chore / refactor）。

```
feat: レシピ詳細ページの SSR 実装
fix: タグ絞り込みのページング不具合を修正
docs: 開発ルールを更新
```

## 環境変数・シークレット

- 秘密情報（DB 接続文字列、OAuth クレデンシャル等）は git 管理外に置く
  - ローカル：`.dev.vars` / `.env`（gitignore 対象）
  - 本番：`wrangler secret put`
- 必要な変数名は `.dev.vars.example` に明示する（値は書かない）

## 品質

- TypeScript は `strict: true`
- Lint / Format は Biome、テストは Vitest（ロジック中心にユニットテスト）
- PR 前に `biome check` と `tsc --noEmit` を通す
