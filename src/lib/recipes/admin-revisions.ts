import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { recipeRevisions, recipes } from "../../db/schema";
import { requireAdminContext } from "../auth/require-admin";
import { purgeAfterWrite } from "../cache/public-cache";

interface OwnedRecipe {
	id: string;
	slug: string;
	bodyMd: string;
}

// 所有レシピかどうかを確認する（admin-snippets.ts の assertOwnsRecipe と同じ方針）。
async function assertOwnsRecipe(
	db: Db,
	recipeId: string,
	userId: string,
): Promise<OwnedRecipe> {
	const recipe = await db.query.recipes.findFirst({
		where: eq(recipes.id, recipeId),
		columns: { id: true, authorId: true, slug: true, bodyMd: true },
	});
	if (!recipe || recipe.authorId !== userId) {
		throw new Error("レシピが見つかりません");
	}
	return { id: recipe.id, slug: recipe.slug, bodyMd: recipe.bodyMd };
}

export const adminListRecipeRevisions = createServerFn({ method: "GET" })
	.validator((recipeId: unknown) => {
		if (typeof recipeId !== "string" || recipeId.length === 0) {
			throw new Error("recipeId は必須です");
		}
		return recipeId;
	})
	.handler(async ({ data: recipeId, context }) => {
		const session = await requireAdminContext(context);
		await assertOwnsRecipe(context.db, recipeId, session.user.id);

		const rows = await context.db.query.recipeRevisions.findMany({
			where: eq(recipeRevisions.recipeId, recipeId),
			orderBy: [desc(recipeRevisions.createdAt)],
			columns: { id: true, bodyMd: true, createdAt: true },
		});

		return rows;
	});

export const adminRollbackRecipeRevision = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { recipeId, revisionId } = input as Record<string, unknown>;
		if (typeof recipeId !== "string" || recipeId.length === 0) {
			throw new Error("recipeId は必須です");
		}
		if (typeof revisionId !== "string" || revisionId.length === 0) {
			throw new Error("revisionId は必須です");
		}
		return { recipeId, revisionId };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		const recipe = await assertOwnsRecipe(
			context.db,
			data.recipeId,
			session.user.id,
		);

		const revision = await context.db.query.recipeRevisions.findFirst({
			where: eq(recipeRevisions.id, data.revisionId),
			columns: { id: true, recipeId: true, bodyMd: true },
		});
		if (!revision || revision.recipeId !== data.recipeId) {
			throw new Error("リビジョンが見つかりません");
		}

		const updateRecipe = context.db
			.update(recipes)
			.set({ bodyMd: revision.bodyMd, updatedAt: new Date() })
			.where(eq(recipes.id, data.recipeId));

		// 復元前の本文も、通常の更新と同じくリビジョンとして残す
		// （復元自体を取り消せるようにする）。復元先と現在の本文が同じ場合は
		// 何もしない（無意味なリビジョンを積まない）。
		if (revision.bodyMd !== recipe.bodyMd) {
			await context.db.batch([
				context.db.insert(recipeRevisions).values({
					recipeId: data.recipeId,
					bodyMd: recipe.bodyMd,
				}),
				updateRecipe,
			]);
		} else {
			await updateRecipe;
		}

		await purgeAfterWrite(context.request, { recipeSlugs: [recipe.slug] });
	});
