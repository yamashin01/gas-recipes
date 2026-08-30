-- pg_trgm はトライグラム検索と gin_trgm_ops 索引の前提となる拡張。
-- Neon では PGroonga 等の日本語形態素解析拡張が使えないため、MVP の検索は
-- この拡張だけで組み立てる（docs/proposal.md §5.2、docs/architecture.md §3-4）。
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "code_snippets_code_trgm_idx" ON "code_snippets" USING gin ("code" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recipes_title_trgm_idx" ON "recipes" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recipes_summary_trgm_idx" ON "recipes" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recipes_body_md_trgm_idx" ON "recipes" USING gin ("body_md" gin_trgm_ops);
