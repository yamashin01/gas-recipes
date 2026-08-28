これから実装する内容について、コードを書く前に解説してください。

対象は GAS Recipe Hub（docs/proposal.md を参照）。
技術スタックは TanStack Start / Cloudflare Workers / Neon (Postgres) / Drizzle ORM / BetterAuth です。

解説には以下を含めてください。

- 何のファイルが何個できて、それぞれどういう役割か
- 処理がどう流れるか（リクエストが来てから結果が返るまでなど）
- この構成特有の注意点（該当する場合のみ）
  - TanStack Start は RC 段階のため、Next.js のパターンと混同していないか
  - Cloudflare Workers のリクエストライフサイクル上、
    トップレベルで初期化してはいけないものがないか
  - Neon の接続方式（@neondatabase/serverless の HTTP モード。
    Hyperdrive は Phase 2 まで導入しない）
  - BetterAuth のインスタンス生成タイミング（ミドルウェア先頭で1つだけ）

守ってほしいこと：
- コードは書かないでください
- 文法の説明（TypeScript の型の書き方、React の記法など）は不要です
- 「どう配置してどう繋がるか」の説明に絞ってください
- 不明な点や複数のやり方がある場合は、断定せずに選択肢として提示してください
