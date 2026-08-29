import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// リクエストごとに1つだけ生成し、ミドルウェアチェーンの先頭で下流に共有する
// （docs/architecture.md §3-1）。モジュールトップレベルでは初期化しない。
export function createDb(databaseUrl: string) {
	const sql = neon(databaseUrl);
	return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;
