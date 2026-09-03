import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { collectionItems, collections, recipes } from "../../db/schema";
import { requireAdminContext } from "../auth/require-admin";
import { purgeAfterWrite } from "../cache/public-cache";
import { validateCollectionInput } from "./validate";

interface OwnedCollection {
	id: string;
	slug: string;
}

// 所有コレクションかどうかを確認する（他人のコレクションへの書き込みを防ぐ。
// recipes/admin-recipes.ts の assertOwnsRecipe と同じ方針）。
async function assertOwnsCollection(
	db: Db,
	collectionId: string,
	userId: string,
): Promise<OwnedCollection> {
	const collection = await db.query.collections.findFirst({
		where: eq(collections.id, collectionId),
		columns: { id: true, authorId: true, slug: true },
	});
	if (!collection || collection.authorId !== userId) {
		throw new Error("コレクションが見つかりません");
	}
	return { id: collection.id, slug: collection.slug };
}

// コレクション内のレシピ構成が変わったら updatedAt を進める。sitemap.xml の
// <lastmod> が実際の更新に追随するようにするため（sitemap.ts・PR #30 と同じ方針）。
async function touchCollection(db: Db, collectionId: string) {
	await db
		.update(collections)
		.set({ updatedAt: new Date() })
		.where(eq(collections.id, collectionId));
}

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------
export const adminListCollections = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const session = await requireAdminContext(context);

		const rows = await context.db.query.collections.findMany({
			where: eq(collections.authorId, session.user.id),
			orderBy: [desc(collections.updatedAt)],
			columns: { id: true, title: true, status: true, updatedAt: true },
			with: {
				collectionItems: { columns: { recipeId: true } },
			},
		});

		return rows.map((collection) => ({
			id: collection.id,
			title: collection.title,
			status: collection.status,
			updatedAt: collection.updatedAt,
			itemCount: collection.collectionItems.length,
		}));
	},
);

export const adminGetCollection = createServerFn({ method: "GET" })
	.validator((id: unknown) => {
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return id;
	})
	.handler(async ({ data: id, context }) => {
		const session = await requireAdminContext(context);

		const collection = await context.db.query.collections.findFirst({
			where: eq(collections.id, id),
			columns: {
				id: true,
				title: true,
				slug: true,
				description: true,
				status: true,
				authorId: true,
			},
			with: {
				collectionItems: {
					orderBy: [asc(collectionItems.sortOrder)],
					columns: { recipeId: true, sortOrder: true },
					with: {
						recipe: { columns: { title: true, status: true } },
					},
				},
			},
		});

		// 存在しない・他人のコレクションはどちらも 404 として扱う
		if (!collection || collection.authorId !== session.user.id) {
			return null;
		}

		return {
			id: collection.id,
			title: collection.title,
			slug: collection.slug,
			description: collection.description,
			status: collection.status,
			items: collection.collectionItems.map((item) => ({
				recipeId: item.recipeId,
				title: item.recipe.title,
				status: item.recipe.status,
				sortOrder: item.sortOrder,
			})),
		};
	});

// ---------------------------------------------------------------------------
// mutations: collections
// ---------------------------------------------------------------------------
export const adminCreateCollection = createServerFn({ method: "POST" })
	.validator(validateCollectionInput)
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);

		const existing = await context.db.query.collections.findFirst({
			where: eq(collections.slug, data.slug),
			columns: { id: true },
		});
		if (existing) {
			throw new Error(`スラッグ「${data.slug}」は既に使用されています`);
		}

		const [collection] = await context.db
			.insert(collections)
			.values({
				title: data.title,
				slug: data.slug,
				description: data.description,
				status: data.status,
				authorId: session.user.id,
				publishedAt: data.status === "published" ? new Date() : null,
			})
			.returning({ id: collections.id });

		if (data.status === "published") {
			await purgeAfterWrite(context.request, {
				collectionSlugs: [data.slug],
			});
		}

		return { id: collection.id };
	});

export const adminUpdateCollection = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { id, ...rest } = input as Record<string, unknown>;
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return { id, ...validateCollectionInput(rest) };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);

		const current = await context.db.query.collections.findFirst({
			where: eq(collections.id, data.id),
			columns: { id: true, authorId: true, slug: true, publishedAt: true },
		});
		if (!current || current.authorId !== session.user.id) {
			throw new Error("コレクションが見つかりません");
		}

		if (data.slug !== current.slug) {
			const conflict = await context.db.query.collections.findFirst({
				where: eq(collections.slug, data.slug),
				columns: { id: true },
			});
			if (conflict) {
				throw new Error(`スラッグ「${data.slug}」は既に使用されています`);
			}
		}

		// 初回公開時刻のみ設定する（recipes と同じ方針）
		const publishedAt =
			data.status === "published" && !current.publishedAt
				? new Date()
				: current.publishedAt;

		await context.db
			.update(collections)
			.set({
				title: data.title,
				slug: data.slug,
				description: data.description,
				status: data.status,
				publishedAt,
				updatedAt: new Date(),
			})
			.where(eq(collections.id, data.id));

		// slug を変えた場合は旧 URL のキャッシュも破棄する
		await purgeAfterWrite(context.request, {
			collectionSlugs: [data.slug, current.slug],
		});

		return { id: data.id };
	});

export const adminDeleteCollection = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		const id = (input as { id?: unknown } | null)?.id;
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return { id };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);

		const current = await context.db.query.collections.findFirst({
			where: eq(collections.id, data.id),
			columns: { authorId: true, slug: true },
		});
		if (!current || current.authorId !== session.user.id) {
			throw new Error("コレクションが見つかりません");
		}

		// collection_items は ON DELETE CASCADE で追随して削除される
		await context.db.delete(collections).where(eq(collections.id, data.id));

		await purgeAfterWrite(context.request, {
			collectionSlugs: [current.slug],
		});
	});

// ---------------------------------------------------------------------------
// mutations: collection_items
// ---------------------------------------------------------------------------
export const adminAddCollectionItem = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { collectionId, recipeId } = input as Record<string, unknown>;
		if (typeof collectionId !== "string" || collectionId.length === 0) {
			throw new Error("collectionId は必須です");
		}
		if (typeof recipeId !== "string" || recipeId.length === 0) {
			throw new Error("recipeId は必須です");
		}
		return { collectionId, recipeId };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		const collection = await assertOwnsCollection(
			context.db,
			data.collectionId,
			session.user.id,
		);

		// 追加できるのは自分自身が所有するレシピのみ（他人のレシピを勝手に
		// シリーズへ組み込めないようにする）
		const recipe = await context.db.query.recipes.findFirst({
			where: eq(recipes.id, data.recipeId),
			columns: { id: true, authorId: true, title: true, status: true },
		});
		if (!recipe || recipe.authorId !== session.user.id) {
			throw new Error("レシピが見つかりません");
		}

		const existing = await context.db.query.collectionItems.findFirst({
			where: and(
				eq(collectionItems.collectionId, data.collectionId),
				eq(collectionItems.recipeId, data.recipeId),
			),
			columns: { recipeId: true },
		});
		if (existing) {
			throw new Error("このレシピは既にシリーズに追加されています");
		}

		const [{ nextSortOrder }] = await context.db
			.select({
				nextSortOrder: sql<number>`coalesce(max(${collectionItems.sortOrder}), -1) + 1`,
			})
			.from(collectionItems)
			.where(eq(collectionItems.collectionId, data.collectionId));

		await context.db.insert(collectionItems).values({
			collectionId: data.collectionId,
			recipeId: data.recipeId,
			sortOrder: nextSortOrder,
		});

		await touchCollection(context.db, collection.id);
		await purgeAfterWrite(context.request, {
			collectionSlugs: [collection.slug],
		});

		return {
			recipeId: recipe.id,
			title: recipe.title,
			status: recipe.status,
			sortOrder: nextSortOrder,
		};
	});

export const adminRemoveCollectionItem = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { collectionId, recipeId } = input as Record<string, unknown>;
		if (typeof collectionId !== "string" || collectionId.length === 0) {
			throw new Error("collectionId は必須です");
		}
		if (typeof recipeId !== "string" || recipeId.length === 0) {
			throw new Error("recipeId は必須です");
		}
		return { collectionId, recipeId };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		const collection = await assertOwnsCollection(
			context.db,
			data.collectionId,
			session.user.id,
		);

		await context.db
			.delete(collectionItems)
			.where(
				and(
					eq(collectionItems.collectionId, data.collectionId),
					eq(collectionItems.recipeId, data.recipeId),
				),
			);

		await touchCollection(context.db, collection.id);
		await purgeAfterWrite(context.request, {
			collectionSlugs: [collection.slug],
		});
	});

export const adminReorderCollectionItems = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { collectionId, orderedRecipeIds } = input as Record<string, unknown>;
		if (typeof collectionId !== "string" || collectionId.length === 0) {
			throw new Error("collectionId は必須です");
		}
		if (
			!Array.isArray(orderedRecipeIds) ||
			orderedRecipeIds.some((id) => typeof id !== "string")
		) {
			throw new Error("orderedRecipeIds が不正です");
		}
		return { collectionId, orderedRecipeIds: orderedRecipeIds as string[] };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		const collection = await assertOwnsCollection(
			context.db,
			data.collectionId,
			session.user.id,
		);

		if (data.orderedRecipeIds.length === 0) {
			return;
		}

		const existing = await context.db
			.select({ recipeId: collectionItems.recipeId })
			.from(collectionItems)
			.where(eq(collectionItems.collectionId, data.collectionId));
		const existingIds = new Set(existing.map((row) => row.recipeId));

		// 対象コレクションに属さない ID が混ざっていないかを検証してから並び替える
		if (
			data.orderedRecipeIds.length !== existingIds.size ||
			!data.orderedRecipeIds.every((id) => existingIds.has(id))
		) {
			throw new Error("並び替えに失敗しました");
		}

		// neon-http は db.transaction() 非対応のため、db.batch() で1リクエストに
		// まとめる（admin-snippets.ts の adminReorderSnippets と同じ方針）。
		const [firstId, ...restIds] = data.orderedRecipeIds;
		await context.db.batch([
			context.db
				.update(collectionItems)
				.set({ sortOrder: 0 })
				.where(
					and(
						eq(collectionItems.collectionId, data.collectionId),
						eq(collectionItems.recipeId, firstId),
					),
				),
			...restIds.map((id, index) =>
				context.db
					.update(collectionItems)
					.set({ sortOrder: index + 1 })
					.where(
						and(
							eq(collectionItems.collectionId, data.collectionId),
							eq(collectionItems.recipeId, id),
						),
					),
			),
		]);

		await touchCollection(context.db, collection.id);
		await purgeAfterWrite(context.request, {
			collectionSlugs: [collection.slug],
		});
	});
