# GASレシピ & 教材ナレッジベース 企画書

**仮称：GAS Recipe Hub**
作成日：2026年8月28日 / 作成者：山田慎也

---

## 1. 背景と目的

### 1.1 背景

GAS の受託開発を継続する中で、過去案件で書いたコードやパターンが個々のプロジェクトに散在している。同じような処理を再度書き起こす場面が繰り返し発生しており、資産として蓄積されていない状態にある。

また、シンラボでの勉強会・イベント運営においても、扱ったコード例の管理場所が分散しており、教材とスニペットが紐付いていない。

### 1.2 目的

本プロジェクトは、次の2つの目的を同時に満たすことを狙う。

**目的A：技術学習**
TanStack Start / Cloudflare Workers / Drizzle / BetterAuth / Neon の5つを、チュートリアルではなく実運用するサービスを通じて習得する。

**目的B：実務資産化**
GAS のコードスニペットとノウハウを検索可能な形で蓄積し、受託開発の効率を上げる。将来的にはシンラボの教材コンテンツと接続する。

### 1.3 なぜこの題材か

学習題材として管理画面のみの CRUD アプリを選ぶと、Cloudflare Workers を採用する必然性がなくなり、エッジ配信・キャッシュまわりの学習が形骸化する。

本サービスは **公開読み取りが中心、書き込みは限定的** という構造を持つため、エッジキャッシュと Hyperdrive の読み取りキャッシュが本来の効果を発揮する。採用技術それぞれに「使う理由」が成立する点が、この題材を選ぶ最大の根拠である。

---

## 2. サービス概要

### 2.1 コンセプト

GAS の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース。

- 誰でも閲覧できる公開ナレッジベース（SEO 対象）
- 書き込みは認証済みの管理者のみ
- レシピはタグと教材シリーズ（コレクション）で構造化される
- コードはワンクリックでコピーできる

### 2.2 想定ユーザー

| 区分 | 説明 | 主な行動 |
|---|---|---|
| 自分（管理者） | 案件中にレシピを探す／新規に登録する | 検索・閲覧・投稿・編集 |
| シンラボ会員 | 勉強会・イベントで扱ったコードを後から参照する | 検索・閲覧 |
| 一般の GAS 学習者 | 検索流入で個別レシピに到達する | 閲覧 |

### 2.3 想定ユースケース

- 案件中に「スプレッドシートの特定列を条件付きでフィルタする処理」を思い出せず検索する
- 勉強会で説明したコードを、シンラボ会員に URL 一本で共有する
- 複数のレシピを束ねて「GAS 入門シリーズ」として教材化する

---

## 3. スコープ

### 3.1 MVP（Phase 1）

| 機能 | 内容 |
|---|---|
| レシピ閲覧 | 一覧・詳細。SSR による初期表示とインデックス対応 |
| レシピ投稿・編集 | Markdown 本文＋コードブロック。下書き／公開の状態管理 |
| タグ | レシピへのタグ付与、タグ別一覧 |
| 検索 | タイトル・本文・コードを対象とした全文検索 |
| 認証 | Google ソーシャルログイン。管理者ロールのみ書き込み可 |
| コードコピー | コードブロック単位のコピーボタン |

### 3.2 Phase 2

- コレクション（レシピを束ねた教材シリーズ）
- リビジョン履歴（編集前の本文を保持）
- 画像アップロード（R2）
- 閲覧数の集計（Cron Triggers による日次バッチ）
- RSS / OGP 画像の動的生成

### 3.3 Phase 3（構想）

- シンラボ会員限定レシピ（BetterAuth の organization / role による出し分け）
- ベクトル検索による類似レシピ提示（Vectorize + Workers AI）

### 3.4 スコープ外

学習目的を逸脱するため、当面は次を扱わない。

- 複数ライターによる共同編集・承認フロー
- コメント機能
- 課金

---

## 4. 技術構成

### 4.1 全体像

```
Cloudflare Workers （TanStack Start / SSR + server functions）
  ├─ @neondatabase/serverless ──→ Neon Postgres (Free)  ← Drizzle ORM (neon-http)
  ├─ Workers KV ──→ BetterAuth secondaryStorage（セッションキャッシュ）
  ├─ R2 ─────────→ 画像・添付（Phase 2）
  └─ Cron Triggers → 閲覧数集計・定期処理（Phase 2）

DNS / CDN：Cloudflare（ドメインのネームサーバーを移管）
```

### 4.2 採用理由

| 技術 | 採用理由 |
|---|---|
| TanStack Start | 型安全なルーティングと server functions。URL as state が検索・タグ絞り込みと直接噛み合う |
| Cloudflare Workers | 公開ページのエッジ配信。Vite プラグインによる TanStack Start 公式サポート |
| Neon Postgres | 無料枠で恒久運用可能。ブランチ機能でマイグレーションを安全に試せる |
| Drizzle ORM | 型定義とスキーマの一元管理。drizzle-kit によるマイグレーション運用 |
| BetterAuth | セルフホスト型。ロール管理まで含めて学習対象にできる |

### 4.3 接続方式の方針

Neon への接続は**段階的に切り替える**。

- **Phase 1：`@neondatabase/serverless`（HTTP モード）＋ `drizzle-orm/neon-http`**
  Workers 上で Node 互換の問題が発生しにくく、設定が最小。まずこれで完成させる。
- **Phase 2：Hyperdrive ＋ `node-postgres`（8.16.3 以上）に差し替え**
  接続プールと読み取りキャッシュの効果を、切り替え前後で比較して体感する。

両者は併用しない。Neon の serverless driver は WebSocket / HTTP を使うため、TCP 前提の Hyperdrive のプーリングをバイパスしてしまい、併用しても効果が得られない。

---

## 5. データモデル

BetterAuth が自動生成する認証テーブル（user / session / account / verification）に加え、アプリケーション側で以下を定義する。

### 5.1 テーブル定義

**recipes**

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | PK |
| slug | text | ユニーク。URL に使用 |
| title | text | |
| summary | text | 一覧・OGP 用の要約 |
| body_md | text | Markdown 本文 |
| status | text | `draft` / `published` |
| visibility | text | `public` / `members`（Phase 3） |
| author_id | text | FK → user.id |
| search_vector | tsvector | 全文検索用（生成カラム） |
| view_count | integer | 集計値（Phase 2） |
| published_at | timestamptz | |
| created_at / updated_at | timestamptz | |

**code_snippets**

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | PK |
| recipe_id | uuid | FK → recipes.id, ON DELETE CASCADE |
| filename | text | 例：`Code.gs` |
| language | text | `javascript` / `json` など |
| code | text | |
| sort_order | integer | |

本文とコードを分離する理由は、コード単体での検索とコピー操作を扱いやすくするため。

**tags**

| カラム | 型 |
|---|---|
| id | uuid |
| slug | text（ユニーク） |
| name | text |

**recipe_tags**（中間テーブル）

| カラム | 型 |
|---|---|
| recipe_id | uuid |
| tag_id | uuid |

複合主キー。

**collections / collection_items**（Phase 2）

教材シリーズを表現する。`collection_items` は `collection_id`, `recipe_id`, `sort_order` を持つ。

**recipe_revisions**（Phase 2）

`recipe_id`, `body_md`, `created_at` を保持し、編集前の状態を追跡する。

### 5.2 検索の実装方針

Postgres の全文検索を使うが、**日本語の扱いに注意が必要**。

Neon では PGroonga などの日本語形態素解析拡張は利用できない。そのため、次のハイブリッド構成を採る。

1. `pg_trgm` 拡張によるトライグラム検索（部分一致・表記ゆれに強い）
2. `tsvector` による英語・コード識別子の検索
3. 両者のスコアを合成して並べ替え

MVP 段階では 1 のみで実装し、精度に不満が出た時点で 2 を追加する。

---

## 6. 画面構成

TanStack Start のファイルベースルーティングに対応させる。

| パス | 内容 | 認証 |
|---|---|---|
| `/` | トップ。最新レシピ・人気タグ | 不要 |
| `/recipes` | レシピ一覧（タグ絞り込み・ページング） | 不要 |
| `/recipes/$slug` | レシピ詳細 | 不要 |
| `/tags/$slug` | タグ別一覧 | 不要 |
| `/search` | 検索結果。クエリは URL に保持 | 不要 |
| `/collections/$slug` | 教材シリーズ（Phase 2） | 不要 |
| `/admin` | 管理ダッシュボード | 必要 |
| `/admin/recipes/new` | 新規作成 | 必要 |
| `/admin/recipes/$id/edit` | 編集 | 必要 |
| `/api/auth/*` | BetterAuth ハンドラ | — |

一覧・検索の絞り込み条件は TanStack Router の search params として管理し、URL の共有・ブラウザバックが破綻しない状態を保つ。

---

## 7. 認証設計

- プロバイダ：Google OAuth
- ロール：`admin`（書き込み可）/ `user`（閲覧のみ）
- セッション：Workers KV を `secondaryStorage` に指定してキャッシュ

### 7.1 KV キャッシュを必須とする理由

Neon の Free プランは5分間のアイドルでコンピュートがゼロにスケールし、次の接続時に 500ms〜2秒のコールドスタートが発生する。

BetterAuth はリクエストごとにセッションを検証するため、この遅延が**認証パス全体に直撃する**。KV によるセッションキャッシュは性能改善のオプションではなく、この構成における必須要件と位置付ける。

### 7.2 実装上の制約

Cloudflare Workers では DB バインディングがリクエストハンドラ内でしか取得できないため、`betterAuth()` をモジュールのトップレベルで初期化できない。

**ミドルウェアチェーンの先頭で Drizzle インスタンスを1つ生成し、下流全体で共有する**構成を厳守する。リクエスト内で複数の auth インスタンスを生成すると、長時間のハングや原因の特定しづらい 503 が発生することが報告されている。

---

## 8. 開発フェーズとマイルストーン

| フェーズ | 内容 | 目安 |
|---|---|---|
| Phase 0 | 環境構築。TanStack Start + Cloudflare Vite プラグイン、`wrangler.jsonc`（`nodejs_compat`、`main` 指定）、Neon プロジェクト作成、Drizzle 接続確認、Hello World デプロイ | 1週目 |
| Phase 1a | スキーマ定義と drizzle-kit マイグレーション。Neon ブランチでの試行フローを確立 | 2週目 |
| Phase 1b | BetterAuth 導入。Google ログイン、ロール判定、KV セッションキャッシュ | 3週目 |
| Phase 1c | レシピ CRUD、タグ、管理画面 | 4〜5週目 |
| Phase 1d | 検索（pg_trgm）、公開ページの SSR・エッジキャッシュ、独自ドメイン接続 | 6週目 |
| Phase 2 | コレクション、リビジョン、R2、Cron 集計、Hyperdrive への切り替え | 7週目以降 |

Phase 0 のデプロイまでを最優先とする。ローカルで動いても Workers 本番で落ちる類の問題は早期に洗い出す。

---

## 9. 学習目標との対応

| 技術 | 到達目標 | 対応する実装箇所 |
|---|---|---|
| TanStack Start | ルートローダー、server functions、search params による状態管理を説明できる | レシピ一覧・検索・管理画面 |
| Cloudflare Workers | Workers ランタイムの制約と `nodejs_compat` の役割を説明できる | Phase 0 全般 |
| Cloudflare（周辺） | KV / R2 / Cron / Hyperdrive の使い分けを説明できる | セッション・画像・集計・接続切替 |
| Drizzle | スキーマ定義、リレーション、マイグレーション運用を説明できる | Phase 1a |
| BetterAuth | ソーシャルログイン、セッション管理、ロール制御を実装できる | Phase 1b |
| Neon | ブランチを使った安全なスキーマ変更フローを実践できる | Phase 1a 以降の全マイグレーション |

---

## 10. コスト

| 項目 | 月額 |
|---|---|
| Cloudflare Workers | 0円（無料プラン） |
| Neon Postgres | 0円（Free プラン） |
| Workers KV / R2 / Cron | 0円（無料枠内） |
| ドメイン | 既存ドメインのサブドメインを使用すれば0円 |
| **合計** | **0円** |

Neon Free プランは超過課金が発生しない。CU-hours を使い切った場合はコンピュートが次の請求期間まで停止するのみで、データは失われない。ウォームアップ目的の定期実行は枠を消費するため設定しない。

---

## 11. リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| TanStack Start が RC 段階で情報が少ない | 実装が詰まる | 公式ドキュメントと GitHub Discussions を一次情報とする。Next.js の知識を安易に転用しない |
| BetterAuth の Workers 特有の初期化問題 | 断続的な 503・ハング | ミドルウェア先頭でのインスタンス共有を設計段階で固定 |
| BetterAuth CLI が DB バインディングに到達できない | スキーマ生成が失敗 | drizzle-kit 側に直接接続文字列を指す別設定を用意 |
| 日本語全文検索の精度不足 | 検索が使い物にならない | MVP は pg_trgm で割り切り、精度不足なら tsvector との併用へ拡張 |
| Neon のコールドスタート | 初回アクセスが遅い | KV セッションキャッシュ＋公開ページのエッジキャッシュで DB 到達自体を減らす |
| スコープの膨張 | 完成しない | Phase 1 のスコープを凍結。追加要望は Phase 2 以降に積む |
| 独自ドメイン設定 | 公開できない | ネームサーバーを Cloudflare へ移管する必要がある。Vercel のような CNAME のみの設定は不可 |

---

## 12. 完了の定義

### 学習面

- 採用した5技術それぞれについて、選定理由と実装上の注意点を第三者に説明できる
- Hyperdrive への切り替え前後の差分を、自分の言葉で説明できる

### 実用面

- 自分の GAS レシピが 20 件以上登録されている
- 実際の受託案件の中で、少なくとも1回このサービスを参照してコードを再利用した
- 独自ドメインで公開され、検索エンジンにインデックスされている

---

## 付録：初期セットアップの確認事項

- [ ] `wrangler.jsonc` に `compatibility_flags: ["nodejs_compat"]` を設定
- [ ] `wrangler.jsonc` の `main` を `@tanstack/react-start/server-entry` に設定
- [ ] `vite.config.ts` で `cloudflare({ viteEnvironment: { name: 'ssr' } })` を指定
- [ ] Neon のプロジェクト作成、開発用ブランチの作成
- [ ] Drizzle の接続を `drizzle-orm/neon-http` で構成
- [ ] `.dev.vars` と Workers Secrets の使い分けを整理
- [ ] ドメインのネームサーバーを Cloudflare へ移管