import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit は Workers の DB バインディングに到達できないため、
// ここでは Neon への直接接続文字列を .env から読み込む（docs/architecture.md §3-5）。
// dotenv はデフォルトで既存の process.env を上書きしない。
config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
	);
}

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
});
