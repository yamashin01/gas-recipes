import { relations, sql } from "drizzle-orm";
import {
	boolean,
	customType,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// auth（BetterAuth 自動生成テーブルの最小プレースホルダー）
// ---------------------------------------------------------------------------
// Phase 1a では recipes.author_id の FK 整合を取るために `user` のみを最小限で
// 定義する（docs/proposal.md §5.1）。Phase 1b で BetterAuth を導入する際、
// CLI が生成する実際のスキーマ（session / account / verification を含む）に
// 合わせて置き換える（docs/proposal.md §7、CLAUDE.md 環境変数・シークレット）。
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	// admin: 書き込み可 / user: 閲覧のみ（docs/proposal.md §7）
	role: text("role").notNull().default("user"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// ---------------------------------------------------------------------------
// recipes / code_snippets
// ---------------------------------------------------------------------------
const tsvector = customType<{ data: string }>({
	dataType() {
		return "tsvector";
	},
});

export const recipeStatus = pgEnum("recipe_status", ["draft", "published"]);
// members は Phase 3（シンラボ会員限定公開）で使用する（docs/proposal.md §3.3）
export const recipeVisibility = pgEnum("recipe_visibility", [
	"public",
	"members",
]);

export const recipes = pgTable("recipes", {
	id: uuid("id").primaryKey().defaultRandom(),
	// URL に使用するため一意（docs/proposal.md §5.1）
	slug: text("slug").notNull().unique(),
	title: text("title").notNull(),
	summary: text("summary").notNull().default(""),
	bodyMd: text("body_md").notNull().default(""),
	status: recipeStatus("status").notNull().default("draft"),
	visibility: recipeVisibility("visibility").notNull().default("public"),
	authorId: text("author_id")
		.notNull()
		.references(() => user.id),
	// 全文検索用の生成カラム。MVP では pg_trgm を主に使い、精度不足時にこちらを
	// 併用する（docs/proposal.md §5.2）。
	searchVector: tsvector("search_vector").generatedAlwaysAs(
		sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(body_md, ''))`,
	),
	viewCount: integer("view_count").notNull().default(0),
	publishedAt: timestamp("published_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const codeSnippets = pgTable(
	"code_snippets",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		recipeId: uuid("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		filename: text("filename").notNull(),
		language: text("language").notNull(),
		code: text("code").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [index("code_snippets_recipe_id_idx").on(table.recipeId)],
);

// ---------------------------------------------------------------------------
// tags / recipe_tags
// ---------------------------------------------------------------------------
export const tags = pgTable("tags", {
	id: uuid("id").primaryKey().defaultRandom(),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
});

export const recipeTags = pgTable(
	"recipe_tags",
	{
		recipeId: uuid("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.recipeId, table.tagId] }),
		// 複合 PK は recipe_id 起点の検索しかカバーしないため、tag_id 単独の
		// 検索（/tags/$slug 等）用に別途インデックスを張る。
		index("recipe_tags_tag_id_idx").on(table.tagId),
	],
);

// ---------------------------------------------------------------------------
// relations
// ---------------------------------------------------------------------------
export const userRelations = relations(user, ({ many }) => ({
	recipes: many(recipes),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
	author: one(user, {
		fields: [recipes.authorId],
		references: [user.id],
	}),
	codeSnippets: many(codeSnippets),
	recipeTags: many(recipeTags),
}));

export const codeSnippetsRelations = relations(codeSnippets, ({ one }) => ({
	recipe: one(recipes, {
		fields: [codeSnippets.recipeId],
		references: [recipes.id],
	}),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
	recipeTags: many(recipeTags),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
	recipe: one(recipes, {
		fields: [recipeTags.recipeId],
		references: [recipes.id],
	}),
	tag: one(tags, {
		fields: [recipeTags.tagId],
		references: [tags.id],
	}),
}));
