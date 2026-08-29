# GAS Recipe Hub

GAS（Google Apps Script）の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース。

## 概要

過去の案件や勉強会で書いた GAS のコードスニペットとノウハウを、検索可能な形で蓄積・公開するサービスです。誰でも閲覧できる公開ナレッジベースとして運用し、書き込みは認証済みの管理者のみが行います。レシピはタグと教材シリーズ（コレクション）で構造化されます。

## 主な機能

- **レシピ閲覧**：一覧・詳細ページ（SSR による初期表示と検索エンジンインデックス対応）
- **レシピ投稿・編集**：Markdown 本文＋コードブロック。下書き／公開の状態管理（管理者のみ）
- **タグ**：レシピへのタグ付与とタグ別一覧
- **全文検索**：タイトル・本文・コードを対象とした検索
- **認証**：Google ソーシャルログイン。管理者ロールのみ書き込み可
- **コードコピー**：コードブロック単位のワンクリックコピー

## ドキュメント

- 企画書：[docs/proposal.md](./docs/proposal.md)
- アーキテクチャ：[docs/architecture.md](./docs/architecture.md)
- 初期セットアップ手順：[Wiki](https://github.com/yamashin01/gas-recipes/wiki)
- 開発ルール：[CLAUDE.md](./CLAUDE.md)

---

© 2026 Shinya Yamada ([yamashin01](https://github.com/yamashin01))
