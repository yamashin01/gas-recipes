import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { createDb } from "../db/client";

// Phase 0 の完了条件（Drizzle 経由での Neon 接続確認）用のヘルスチェック。
export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				try {
					const db = createDb(env.DATABASE_URL);
					await db.execute(sql`select 1`);
					return json({ status: "ok" });
				} catch (error) {
					return json(
						{
							status: "error",
							message: error instanceof Error ? error.message : String(error),
						},
						{ status: 500 },
					);
				}
			},
		},
	},
});
