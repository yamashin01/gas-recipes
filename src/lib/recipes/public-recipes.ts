import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client";
import { codeSnippets, recipes, recipeTags, tags } from "../../db/schema";
import { isSnippetLanguage } from "./snippet-language";

// status = published だけでなく visibility = public も条件にする。
// members は Phase 3（シンラボ会員限定公開）で使う想定のため、
// 公開ページからは現時点でも将来的にも除外する（docs/proposal.md §3.3）。
const PUBLISHED = and(
	eq(recipes.status, "published"),
	eq(recipes.visibility, "public"),
);
export const RECIPES_PAGE_SIZE = 10;

function recipeIdsForTagSlug(db: Db, tagSlug: string) {
	return db
		.select({ id: recipeTags.recipeId })
		.from(recipeTags)
		.innerJoin(tags, eq(tags.id, recipeTags.tagId))
		.where(eq(tags.slug, tagSlug));
}

export const getHomeData = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const [latestRecipes, popularTags] = await Promise.all([
			context.db.query.recipes.findMany({
				where: PUBLISHED,
				orderBy: [desc(recipes.publishedAt)],
				limit: 6,
				columns: {
					id: true,
					slug: true,
					title: true,
					summary: true,
					publishedAt: true,
				},
				with: {
					recipeTags: {
						with: { tag: { columns: { slug: true, name: true } } },
					},
				},
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
			latestRecipes: latestRecipes.map((recipe) => ({
				id: recipe.id,
				slug: recipe.slug,
				title: recipe.title,
				summary: recipe.summary,
				publishedAt: recipe.publishedAt,
				tags: recipe.recipeTags.map((rt) => rt.tag),
			})),
			popularTags,
		};
	},
);

export const listPublishedRecipes = createServerFn({ method: "GET" })
	.validator((input: unknown) => {
		const raw = (input ?? {}) as { tagSlug?: unknown; page?: unknown };
		const tagSlug =
			typeof raw.tagSlug === "string" && raw.tagSlug ? raw.tagSlug : undefined;
		const page =
			typeof raw.page === "number" && Number.isInteger(raw.page) && raw.page > 0
				? raw.page
				: 1;
		return { tagSlug, page };
	})
	.handler(async ({ data, context }) => {
		const where = data.tagSlug
			? and(
					PUBLISHED,
					inArray(recipes.id, recipeIdsForTagSlug(context.db, data.tagSlug)),
				)
			: PUBLISHED;
		const offset = (data.page - 1) * RECIPES_PAGE_SIZE;

		const [rows, [{ total }]] = await Promise.all([
			context.db.query.recipes.findMany({
				where,
				orderBy: [desc(recipes.publishedAt)],
				limit: RECIPES_PAGE_SIZE,
				offset,
				columns: {
					id: true,
					slug: true,
					title: true,
					summary: true,
					publishedAt: true,
				},
				with: {
					recipeTags: {
						with: { tag: { columns: { slug: true, name: true } } },
					},
				},
			}),
			context.db.select({ total: count() }).from(recipes).where(where),
		]);

		return {
			items: rows.map((recipe) => ({
				id: recipe.id,
				slug: recipe.slug,
				title: recipe.title,
				summary: recipe.summary,
				publishedAt: recipe.publishedAt,
				tags: recipe.recipeTags.map((rt) => rt.tag),
			})),
			page: data.page,
			pageSize: RECIPES_PAGE_SIZE,
			totalPages: Math.max(1, Math.ceil(total / RECIPES_PAGE_SIZE)),
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
