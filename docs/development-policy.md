# 開発ルール

作成日：2026年8月28日

本書は日々の開発で守る運用ルールのみを定める。それ以外は次を参照する。

- 機能要件・技術選定の理由 → [企画書](./proposal.md)
- 技術構成・設計上の制約 → [アーキテクチャ](./architecture.md)
- フェーズ・タスク管理 → GitHub Issues（フェーズ単位の親イシュー #1〜#6 とそのサブイシュー）

## 1. ブランチ・PR 運用

- `main` を常にデプロイ可能な状態に保つ。`main` への直接 push はしない
- Issue 単位で `feature/<issue番号>-<短い名前>` ブランチを切り、PR で `main` にマージする
  - 例：`feature/10-drizzle-schema`
- PR 本文に `Closes #<issue番号>` を記載し、マージで Issue が自動クローズされるようにする
- PR テンプレートに沿って動作確認内容を記載する
- セルフマージ可（単独開発のため）。ただしチェックリストを満たしてからマージする

## 2. コミット規約

Conventional Commits に従う（feat / fix / docs / chore / refactor）。

```
feat: レシピ詳細ページの SSR 実装
fix: タグ絞り込みのページング不具合を修正
docs: 開発ルールを更新
```

## 3. 環境変数・シークレット

- 秘密情報（DB 接続文字列、OAuth クレデンシャル等）は git 管理外に置く
  - ローカル：`.dev.vars` / `.env`（gitignore 対象）
  - 本番：`wrangler secret put`
- 必要な変数名は `.dev.vars.example` に明示する（値は書かない）

## 4. 品質

- TypeScript は `strict: true`
- Lint / Format は Biome、テストは Vitest（ロジック中心にユニットテスト）
- PR 前に `biome check` と `tsc --noEmit` を通す

## 5. スコープ管理

- Phase 1（MVP）のスコープは凍結する。追加要望は実装せず、Issue 化して Phase 2 以降のバックログに積む
