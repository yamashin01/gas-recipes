import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Phase 2: Hyperdrive + node-postgres（8.16.3 以上）に切り替えた
// （@neondatabase/serverless の HTTP モードとは併用しない。ドライバごと
// 差し替える。docs/architecture.md §2、issue #22）。connectionString には
// env.HYPERDRIVE.connectionString（Hyperdrive が発行するプール接続文字列）
// を渡す。drizzle-kit CLI（generate/migrate/studio）は Hyperdrive を経由
// できないため、引き続き Neon への直接接続文字列（.env の DATABASE_URL）を
// 使う（docs/migration-flow.md）。
//
// リクエストごとに1つだけ生成し、ミドルウェアチェーンの先頭で下流に共有する
// （docs/architecture.md §3-1）。モジュールトップレベルでは初期化しない。
// Pool はリクエストの終わりに閉じる必要がある（src/start.ts 参照。Cloudflare
// の Hyperdrive + node-postgres の推奨パターン）。
export function createDb(connectionString: string) {
	const pool = new Pool({ connectionString });
	return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
