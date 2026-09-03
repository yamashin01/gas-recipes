import { waitUntil } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client";
import { codeSnippets, recipes, recipeTags, tags } from "../../db/schema";
import { recordRecipeView } from "../views/record-view";
import { PUBLISHED } from "./published";
import { isSnippetLanguage } from "./snippet-language";

export { PUBLISHED } from "./published";
export const RECIPES_PAGE_SIZE = 10;

function recipeIdsForTagSlug(db: Db, tagSlug: string) {
	return db
		.select({ id: recipeTags.recipeId })
		.from(recipeTags)
		.innerJoin(tags, eq(tags.id, recipeTags.tagId))
		.where(eq(tags.slug, tagSlug));
}

const HOME_RECIPE_COLUMNS = {
	id: true,
	slug: true,
	title: true,
	summary: true,
	publishedAt: true,
} as const;
const HOME_RECIPE_WITH = {
	recipeTags: { with: { tag: { columns: { slug: true, name: true } } } },
} as const;

function toRecipeSummary(recipe: {
	id: string;
	slug: string;
	title: string;
	summary: string;
	publishedAt: Date | null;
	recipeTags: { tag: { slug: string; name: string } }[];
}) {
	return {
		id: recipe.id,
		slug: recipe.slug,
		title: recipe.title,
		summary: recipe.summary,
		publishedAt: recipe.publishedAt,
		tags: recipe.recipeTags.map((rt) => rt.tag),
	};
}

export const getHomeData = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const [latestRecipes, popularRecipes, popularTags] = await Promise.all([
			context.db.query.recipes.findMany({
				where: PUBLISHED,
				orderBy: [desc(recipes.publishedAt)],
				limit: 6,
				columns: HOME_RECIPE_COLUMNS,
				with: HOME_RECIPE_WITH,
			}),
			// 閲覧数（recipes.view_count）は Cron Triggers による日次集計値
			// （issue #21）。同数のときは新着順にフォールバックする。
			context.db.query.recipes.findMany({
				where: PUBLISHED,
				orderBy: [desc(recipes.viewCount), desc(recipes.publishedAt)],
				limit: 6,
				columns: HOME_RECIPE_COLUMNS,
				with: HOME_RECIPE_WITH,
			}),
			context.db
				.select({
					id: tags.id,
					slug: tags.slug,
					name: tags.name,
					recipeCount: count(recipeTags.recipeId),
				})
				.from(tags)
				.innerJoin(recipeTags, eq(recipeTags.tagId, tags.id))
				.innerJoin(recipes, eq(recipes.id, recipeTags.recipeId))
				.where(PUBLISHED)
				.groupBy(tags.id)
				.orderBy(desc(count(recipeTags.recipeId)))
				.limit(10),
		]);

		return {
			latestRecipes: latestRecipes.map(toRecipeSummary),
			popularRecipes: popularRecipes.map(toRecipeSummary),
			popularTags,
		};
	},
);

export type RecipeSort = "new" | "popular";

export const listPublishedRecipes = createServerFn({ method: "GET" })
	.validator((input: unknown) => {
		const raw = (input ?? {}) as {
			tagSlug?: unknown;
			page?: unknown;
			sort?: unknown;
		};
		const tagSlug =
			typeof raw.tagSlug === "string" && raw.tagSlug ? raw.tagSlug : undefined;
		const page =
			typeof raw.page === "number" && Number.isInteger(raw.page) && raw.page > 0
				? raw.page
				: 1;
		const sort: RecipeSort = raw.sort === "popular" ? "popular" : "new";
		return { tagSlug, page, sort };
	})
	.handler(async ({ data, context }) => {
		const where = data.tagSlug
			? and(
					PUBLISHED,
					inArray(recipes.id, recipeIdsForTagSlug(context.db, data.tagSlug)),
				)
			: PUBLISHED;
		const offset = (data.page - 1) * RECIPES_PAGE_SIZE;
		// 閲覧数（recipes.view_count）は Cron Triggers による日次集計値
		// （issue #21）。同数のときは新着順にフォールバックする。
		const orderBy =
			data.sort === "popular"
				? [desc(recipes.viewCount), desc(recipes.publishedAt)]
				: [desc(recipes.publishedAt)];

		const [rows, [{ total }]] = await Promise.all([
			context.db.query.recipes.findMany({
				where,
				orderBy,
				limit: RECIPES_PAGE_SIZE,
				offset,
				columns: HOME_RECIPE_COLUMNS,
				with: HOME_RECIPE_WITH,
			}),
			context.db.select({ total: count() }).from(recipes).where(where),
		]);

		return {
			items: rows.map(toRecipeSummary),
			page: data.page,
			pageSize: RECIPES_PAGE_SIZE,
			totalPages: Math.max(1, Math.ceil(total / RECIPES_PAGE_SIZE)),
			sort: data.sort,
		};
	});

export const getTagBySlug = createServerFn({ method: "GET" })
	.validator((slug: unknown) => {
		if (typeof slug !== "string" || slug.length === 0) {
			throw new Error("slug は必須です");
		}
		return slug;
	})
	.handler(async ({ data: slug, context }) => {
		const tag = await context.db.query.tags.findFirst({
			where: eq(tags.slug, slug),
			columns: { id: true, slug: true, name: true },
		});
		return tag ?? null;
	});

export const getPublishedRecipeBySlug = createServerFn({ method: "GET" })
	.validator((slug: unknown) => {
		if (typeof slug !== "string" || slug.length === 0) {
			throw new Error("slug は必須です");
		}
		return slug;
	})
	.handler(async ({ data: slug, context }) => {
		const recipe = await context.db.query.recipes.findFirst({
			where: and(eq(recipes.slug, slug), PUBLISHED),
			columns: {
				id: true,
				slug: true,
				title: true,
				summary: true,
				bodyMd: true,
				publishedAt: true,
			},
			with: {
				recipeTags: { with: { tag: { columns: { slug: true, name: true } } } },
				codeSnippets: {
					orderBy: [asc(codeSnippets.sortOrder)],
					columns: { id: true, filename: true, language: true, code: true },
				},
			},
		});

		if (!recipe) {
			return null;
		}

		// 公開ページの応答を待たせない（issue #21）。エッジキャッシュ HIT 時は
		// このハンドラ自体が呼ばれないため、キャッシュされている間の閲覧は
		// 集計対象に含まれない（docs/architecture.md §4 の許容範囲内とみなす）。
		waitUntil(recordRecipeView(recipe.id));

		return {
			id: recipe.id,
			slug: recipe.slug,
			title: recipe.title,
			summary: recipe.summary,
			bodyMd: recipe.bodyMd,
			publishedAt: recipe.publishedAt,
			tags: recipe.recipeTags.map((rt) => rt.tag),
			snippets: recipe.codeSnippets.map((snippet) => ({
				...snippet,
				language: isSnippetLanguage(snippet.language)
					? snippet.language
					: ("plaintext" as const),
			})),
		};
	});
