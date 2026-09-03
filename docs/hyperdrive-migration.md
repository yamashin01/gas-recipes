# Hyperdrive 切り替え記録

Neon への接続を `@neondatabase/serverless`（HTTP モード）から Hyperdrive +
`node-postgres` へ切り替えた記録（企画書 §4.3・§12、アーキテクチャ §2、issue #22）。

## 変更点

| | Phase 1 | Phase 2（このドキュメント時点） |
|---|---|---|
| ドライバ | `@neondatabase/serverless`（HTTP） | `pg`（node-postgres、TCP） |
| Drizzle アダプタ | `drizzle-orm/neon-http` | `drizzle-orm/node-postgres` |
| 接続経路 | Neon への直接 HTTP リクエスト（リクエストごと） | Hyperdrive（`env.HYPERDRIVE.connectionString`）経由。Hyperdrive がコネクションプールと読み取りキャッシュを Cloudflare のエッジ側で保持する |
| 複数ステートメントの原子性 | `db.batch()`（HTTP 1 リクエストにまとめる。`db.transaction()` 非対応） | `db.transaction()`（本物の TCP セッションによる実トランザクション） |
| Workers 側のリソース管理 | 特に無し（HTTP はステートレス） | リクエストごとに `pg.Pool` を作成し、`waitUntil(db.$client.end())` で終了時に閉じる |

両ドライバは併用しない（Neon serverless driver は WebSocket/HTTP を使うため、
TCP 前提の Hyperdrive のプーリングをバイパスしてしまう）。

## Hyperdrive を有効にする手順（本番）

このリポジトリの `wrangler.jsonc` にはプレースホルダーの Hyperdrive 設定
（id: `REPLACE_WITH_HYPERDRIVE_CONFIG_ID`）だけが入っている。実際に接続するには：

1. Neon の**直接接続文字列**（pooled ではない方。`docs/migration-flow.md` 参照）を用意する
2. `wrangler hyperdrive create gas-recipes-db --connection-string="<Neon の直接接続文字列>"` を実行し、出力された Hyperdrive の id を控える
3. `wrangler.jsonc` の `hyperdrive[0].id` をその id に置き換える
4. `pnpm run cf-typegen` を再実行し、`Env.HYPERDRIVE` の型を反映する
5. `wrangler deploy` でデプロイする

## プレースホルダー ID のままだと `wrangler dev` / `wrangler deploy` が失敗する

`wrangler.jsonc` の `hyperdrive[0].id`（および `kv_namespaces` の
`VIEW_COUNTS_KV`）はこのリポジトリではプレースホルダーのままになっている。
Cloudflare のアカウント操作が必要で、この環境（セッション）からは実行できない
ため、上記の手順1〜3をリポジトリ所有者が実施するまでは：

- `wrangler deploy`（本番）は失敗する
- `wrangler dev`（ローカル）も、Hyperdrive の設定を Cloudflare 側へ問い合わせ
  に行くため失敗する

`main` を常にデプロイ可能な状態に保つ（CLAUDE.md）ため、**このブランチを
`main` にマージする前に上記の手順1〜4を実施し、実際の id に置き換えること。**

ローカル開発だけ先に動かしたい場合は、`.dev.vars.example` にある
`WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` を `.dev.vars` に
コピーして Neon の直接接続文字列を設定すると、`hyperdrive[0].id` が未設定の
ままでも `wrangler dev` はその接続文字列へ直接つなぎに行く（本番デプロイには
実際の id への置き換えが別途必要）。詳細は
[Cloudflare のドキュメント](https://developers.cloudflare.com/hyperdrive/configuration/local-development/)
を参照。

## 切り替え前後のレイテンシ計測

**このセッションには実際の Neon / Cloudflare デプロイ環境への認証情報がない
ため、実測値はここに記録できていない。** 以下は、リポジトリ所有者が実環境で
測定する際の手順と記録用のテンプレート。

### 計測方法

1. Phase 1 相当（`@neondatabase/serverless` + `drizzle-orm/neon-http`）の
   コミット（このドキュメントを追加した PR の直前のコミット）と、Phase 2
   （Hyperdrive 切り替え後）のコミットをそれぞれ `wrangler deploy` する
2. 両方について、以下の2パターンをそれぞれ計測する
   - **コールドスタート時**：しばらくアクセスが無かった状態からの初回リクエスト
     （Workers のアイソレートが新規生成される、かつ Hyperdrive 側のコネクション
     プール／キャッシュも温まっていない状態）
   - **キャッシュヒット時（ウォーム時）**：直前に同じエンドポイントへアクセス
     済みの状態からの連続リクエスト
3. DB に到達する必要があるエンドポイントで計測する（エッジキャッシュ
   （`docs/architecture.md` §4.1）がヒットすると Neon に到達しないため、
   計測対象からは除外するか、`/api/health`（DB 接続確認用、エッジキャッシュ
   対象外）を使う）
4. `curl -w "%{time_total}\n" -o /dev/null -s <URL>` などで応答時間を複数回
   （目安10回程度）取り、中央値・最小値・最大値を記録する

### 記録テンプレート

| 指標 | Phase 1（neon-http） | Phase 2（Hyperdrive + node-postgres） |
|---|---|---|
| コールドスタート時（中央値） | 未計測 | 未計測 |
| ウォーム時（中央値） | 未計測 | 未計測 |

### 期待される傾向（Cloudflare の公開情報に基づく考察）

実測前の仮説として、Cloudflare が公開している Hyperdrive の仕組みから
次の傾向が予想される。裏付けは上記の実測で行うこと。

- **コールドスタート時**：Hyperdrive はコネクションプールをエッジ側
  （Worker のアイソレートとは別）に保持するため、Worker 自体が初回起動でも
  「新規 TCP + TLS ハンドシェイクを Neon まで毎回行う」コストを避けられる
  可能性がある。一方 `@neondatabase/serverless`（HTTP モード）も Fetch API
  ベースで軽量なため、差は環境やリージョンの組み合わせに左右される
- **ウォーム時**：Hyperdrive の読み取りクエリキャッシュがヒットすれば、
  Neon への往復自体が発生せず短縮が期待できる。ただしこのアプリの読み取り
  クエリは大半がエッジキャッシュ（`docs/architecture.md` §4.1）で吸収される
  ため、Hyperdrive のキャッシュ効果が体感できるのは管理画面（エッジキャッシュ
  対象外）や `/api/health` など限られた経路になる
- **書き込み（`db.transaction()` 利用箇所）**：neon-http は `db.transaction()`
  非対応で `db.batch()`（HTTP 1 リクエストにまとめる）を使っていたが、
  node-postgres は本物のトランザクションを使えるため、複数ステートメントの
  原子性という点でも切り替えの意味がある（レイテンシとは別の利点）
