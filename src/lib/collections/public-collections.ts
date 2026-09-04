import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { collectionItems, collections } from "../../db/schema";

export const PUBLISHED_COLLECTION = eq(collections.status, "published");

// コレクションに属する各レシピは、レシピ自体が下書きに戻された/非公開化された
// 場合でも公開ページに出さない（recipes/public-recipes.ts の PUBLISHED と同じ条件）。
function isPublishedRecipe(recipe: {
	status: string;
	visibility: string;
}): boolean {
	return recipe.status === "published" && recipe.visibility === "public";
}

export const getPublishedCollectionBySlug = createServerFn({ method: "GET" })
	.validator((slug: unknown) => {
		if (typeof slug !== "string" || slug.length === 0) {
			throw new Error("slug は必須です");
		}
		return slug;
	})
	.handler(async ({ data: slug, context }) => {
		const collection = await context.db.query.collections.findFirst({
			where: and(eq(collections.slug, slug), PUBLISHED_COLLECTION),
			columns: { slug: true, title: true, description: true },
			with: {
				collectionItems: {
					orderBy: [asc(collectionItems.sortOrder)],
					columns: {},
					with: {
						recipe: {
							columns: {
								slug: true,
								title: true,
								summary: true,
								status: true,
								visibility: true,
								publishedAt: true,
							},
						},
					},
				},
			},
		});

		if (!collection) {
			return null;
		}

		return {
			slug: collection.slug,
			title: collection.title,
			description: collection.description,
			items: collection.collectionItems
				.filter((item) => isPublishedRecipe(item.recipe))
				.map((item) => ({
					slug: item.recipe.slug,
					title: item.recipe.title,
					summary: item.recipe.summary,
					publishedAt: item.recipe.publishedAt,
				})),
		};
	});

export const getCollectionNavigation = createServerFn({ method: "GET" })
	.validator((input: unknown) => {
		const raw = (input ?? {}) as {
			collectionSlug?: unknown;
			recipeSlug?: unknown;
		};
		if (
			typeof raw.collectionSlug !== "string" ||
			raw.collectionSlug.length === 0
		) {
			throw new Error("collectionSlug は必須です");
		}
		if (typeof raw.recipeSlug !== "string" || raw.recipeSlug.length === 0) {
			throw new Error("recipeSlug は必須です");
		}
		return { collectionSlug: raw.collectionSlug, recipeSlug: raw.recipeSlug };
	})
	.handler(async ({ data, context }) => {
		const collection = await context.db.query.collections.findFirst({
			where: and(
				eq(collections.slug, data.collectionSlug),
				PUBLISHED_COLLECTION,
			),
			columns: { slug: true, title: true },
			with: {
				collectionItems: {
					orderBy: [asc(collectionItems.sortOrder)],
					columns: {},
					with: {
						recipe: {
							columns: {
								slug: true,
								title: true,
								status: true,
								visibility: true,
							},
						},
					},
				},
			},
		});
		if (!collection) {
			return null;
		}

		const items = collection.collectionItems
			.map((item) => item.recipe)
			.filter(isPublishedRecipe);
		const index = items.findIndex((recipe) => recipe.slug === data.recipeSlug);
		if (index === -1) {
			return null;
		}

		return {
			collection: { slug: collection.slug, title: collection.title },
			prev:
				index > 0
					? { slug: items[index - 1].slug, title: items[index - 1].title }
					: null,
			next:
				index < items.length - 1
					? { slug: items[index + 1].slug, title: items[index + 1].title }
					: null,
		};
	});
