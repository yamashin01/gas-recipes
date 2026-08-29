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
// auth（BetterAuth のコアスキーマ + admin プラグイン拡張）
// ---------------------------------------------------------------------------
// フィールド定義は better-auth 1.7 系（@better-auth/core の db/schema）と
// admin プラグイン（node_modules/better-auth/dist/plugins/admin/schema.mjs）
// に合わせている。id は better-auth 側で生成するため defaultRandom() は使わない
// （docs/architecture.md §3、CLAUDE.md 環境変数・シークレット）。
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	// admin プラグイン: admin: 書き込み可 / user: 閲覧のみ（docs/proposal.md §7）
	role: text("role").notNull().default("user"),
	banned: boolean("banned").notNull().default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		// admin プラグイン: 別ユーザーへのなりすまし操作を行った管理者の user.id
		impersonatedBy: text("impersonated_by"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		providerId: text("provider_id").notNull(),
		// OAuth プロバイダの発行者。ローカル認証は better-auth が合成した値を持つ
		issuer: text("issuer").notNull(),
		accountId: text("account_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("account_user_id_idx").on(table.userId),
		index("account_provider_account_idx").on(table.providerId, table.accountId),
	],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

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

export const recipes = pgTable(
	"recipes",
	{
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
	},
	(table) => [index("recipes_author_id_idx").on(table.authorId)],
);

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
	sessions: many(session),
	accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id],
	}),
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id],
	}),
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
