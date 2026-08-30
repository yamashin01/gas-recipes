import { createServerFn } from "@tanstack/react-start";
import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client";
import { recipes, recipeTags, tags } from "../../db/schema";
import { requireAdminContext } from "../auth/require-admin";
import { slugifyTagName } from "./slugify";
import { validateRecipeInput } from "./validate";

// ---------------------------------------------------------------------------
// tags: 名前の配列から tag_id を解決する（存在しなければ作成する）
// ---------------------------------------------------------------------------
async function resolveTagIds(db: Db, tagNames: string[]): Promise<string[]> {
	const names = Array.from(
		new Set(tagNames.map((name) => name.trim()).filter(Boolean)),
	);
	if (names.length === 0) return [];

	// 記号だけのタグ名（例："###"）は slugifyTagName で空文字になり、
	// tags.slug のユニーク制約上、複数の異なるタグ名が1つに衝突してしまう。
	const slugs = names.map((name) => {
		const slug = slugifyTagName(name);
		if (!slug) {
			throw new Error(
				`タグ「${name}」から URL に使えるスラッグを生成できません`,
			);
		}
		return slug;
	});

	await db
		.insert(tags)
		.values(names.map((name, i) => ({ name, slug: slugs[i] })))
		.onConflictDoNothing({ target: tags.slug });

	const rows = await db
		.select({ id: tags.id })
		.from(tags)
		.where(inArray(tags.slug, slugs));
	return rows.map((row) => row.id);
}

// レシピのタグ付けを丸ごと置き換える。MVP では差分更新より単純さを優先する。
// neon-http ドライバは db.transaction() 非対応のため（docs/architecture.md §2）、
// 削除と挿入は db.batch() で1回の HTTP リクエスト内のトランザクションにまとめ、
// 途中失敗でタグ関連だけが消えた状態にならないようにする。
async function syncRecipeTags(db: Db, recipeId: string, tagNames: string[]) {
	const tagIds = await resolveTagIds(db, tagNames);
	const deleteExisting = db
		.delete(recipeTags)
		.where(eq(recipeTags.recipeId, recipeId));

	if (tagIds.length === 0) {
		await deleteExisting;
		return;
	}

	await db.batch([
		deleteExisting,
		db.insert(recipeTags).values(tagIds.map((tagId) => ({ recipeId, tagId }))),
	]);
}

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------
export const adminListRecipes = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const session = await requireAdminContext(context);

		const rows = await context.db.query.recipes.findMany({
			where: eq(recipes.authorId, session.user.id),
			orderBy: [desc(recipes.updatedAt)],
			columns: {
				id: true,
				title: true,
				status: true,
				updatedAt: true,
			},
			with: {
				recipeTags: { with: { tag: { columns: { name: true } } } },
			},
		});

		return rows.map((recipe) => ({
			id: recipe.id,
			title: recipe.title,
			status: recipe.status,
			updatedAt: recipe.updatedAt,
			tags: recipe.recipeTags.map((rt) => rt.tag.name),
		}));
	},
);

export const adminGetRecipe = createServerFn({ method: "GET" })
	.validator((id: unknown) => {
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return id;
	})
	.handler(async ({ data: id, context }) => {
		const session = await requireAdminContext(context);

		const recipe = await context.db.query.recipes.findFirst({
			where: eq(recipes.id, id),
			columns: {
				id: true,
				title: true,
				slug: true,
				summary: true,
				bodyMd: true,
				status: true,
				authorId: true,
			},
			with: {
				recipeTags: { with: { tag: { columns: { name: true } } } },
			},
		});

		// 存在しない・他人のレシピはどちらも 404 として扱う（所有者の有無を露呈しない）
		if (!recipe || recipe.authorId !== session.user.id) {
			return null;
		}

		return {
			id: recipe.id,
			title: recipe.title,
			slug: recipe.slug,
			summary: recipe.summary,
			bodyMd: recipe.bodyMd,
			status: recipe.status,
			tags: recipe.recipeTags.map((rt) => rt.tag.name),
		};
	});

// ---------------------------------------------------------------------------
// mutations
// ---------------------------------------------------------------------------
export const adminCreateRecipe = createServerFn({ method: "POST" })
	.validator(validateRecipeInput)
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);

		const existing = await context.db.query.recipes.findFirst({
			where: eq(recipes.slug, data.slug),
			columns: { id: true },
		});
		if (existing) {
			throw new Error(`スラッグ「${data.slug}」は既に使用されています`);
		}

		const [recipe] = await context.db
			.insert(recipes)
			.values({
				title: data.title,
				slug: data.slug,
				summary: data.summary,
				bodyMd: data.bodyMd,
				status: data.status,
				authorId: session.user.id,
				publishedAt: data.status === "published" ? new Date() : null,
			})
			.returning({ id: recipes.id });

		await syncRecipeTags(context.db, recipe.id, data.tags);

		return { id: recipe.id };
	});

export const adminUpdateRecipe = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { id, ...rest } = input as Record<string, unknown>;
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return { id, ...validateRecipeInput(rest) };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);

		const current = await context.db.query.recipes.findFirst({
			where: eq(recipes.id, data.id),
			columns: { id: true, authorId: true, slug: true, publishedAt: true },
		});
		if (!current || current.authorId !== session.user.id) {
			throw new Error("レシピが見つかりません");
		}

		if (data.slug !== current.slug) {
			const conflict = await context.db.query.recipes.findFirst({
				where: eq(recipes.slug, data.slug),
				columns: { id: true },
			});
			if (conflict) {
				throw new Error(`スラッグ「${data.slug}」は既に使用されています`);
			}
		}

		// 初回公開時刻のみ設定する。一度公開したレシピを下書きに戻しても
		// published_at は保持し、再公開時に「初出」の日付が失われないようにする。
		const publishedAt =
			data.status === "published" && !current.publishedAt
				? new Date()
				: current.publishedAt;

		await context.db
			.update(recipes)
			.set({
				title: data.title,
				slug: data.slug,
				summary: data.summary,
				bodyMd: data.bodyMd,
				status: data.status,
				publishedAt,
				updatedAt: new Date(),
			})
			.where(eq(recipes.id, data.id));

		await syncRecipeTags(context.db, data.id, data.tags);

		return { id: data.id };
	});

export const adminDeleteRecipe = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		const id = (input as { id?: unknown } | null)?.id;
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return { id };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);

		const current = await context.db.query.recipes.findFirst({
			where: eq(recipes.id, data.id),
			columns: { authorId: true },
		});
		if (!current || current.authorId !== session.user.id) {
			throw new Error("レシピが見つかりません");
		}

		// code_snippets・recipe_tags は ON DELETE CASCADE で追随して削除される
		await context.db.delete(recipes).where(eq(recipes.id, data.id));
	});
