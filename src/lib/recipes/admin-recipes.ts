import { createServerFn } from "@tanstack/react-start";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client";
import {
	codeSnippets,
	recipeRevisions,
	recipes,
	recipeTags,
	tags,
} from "../../db/schema";
import { requireAdminContext } from "../auth/require-admin";
import { purgeAfterWrite } from "../cache/public-cache";
import { slugifyTagName } from "./slugify";
import { isSnippetLanguage } from "./snippet-language";
import { validateRecipeInput } from "./validate";

// ---------------------------------------------------------------------------
// tags: 名前の配列から tag_id を解決する（存在しなければ作成する）
// ---------------------------------------------------------------------------
async function resolveTagIds(
	db: Db,
	tagNames: string[],
): Promise<{ ids: string[]; slugs: string[] }> {
	const names = Array.from(
		new Set(tagNames.map((name) => name.trim()).filter(Boolean)),
	);
	if (names.length === 0) return { ids: [], slugs: [] };

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
	return { ids: rows.map((row) => row.id), slugs };
}

// キャッシュ破棄の対象になるタグページを知るため、現在のタグ slug を引く
async function currentTagSlugs(db: Db, recipeId: string): Promise<string[]> {
	const rows = await db
		.select({ slug: tags.slug })
		.from(recipeTags)
		.innerJoin(tags, eq(tags.id, recipeTags.tagId))
		.where(eq(recipeTags.recipeId, recipeId));
	return rows.map((row) => row.slug);
}

// レシピのタグ付けを丸ごと置き換える。MVP では差分更新より単純さを優先する。
// 削除と挿入を db.transaction() でまとめ、途中失敗でタグ関連だけが消えた
// 状態にならないようにする（node-postgres ドライバは db.transaction() を
// サポートする。docs/architecture.md §2、issue #22）。
async function syncRecipeTags(
	db: Db,
	recipeId: string,
	tagNames: string[],
): Promise<string[]> {
	const { ids, slugs } = await resolveTagIds(db, tagNames);

	if (ids.length === 0) {
		await db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));
		return slugs;
	}

	await db.transaction(async (tx) => {
		await tx.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));
		await tx
			.insert(recipeTags)
			.values(ids.map((tagId) => ({ recipeId, tagId })));
	});
	return slugs;
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
				codeSnippets: {
					orderBy: [asc(codeSnippets.sortOrder)],
					columns: {
						id: true,
						filename: true,
						language: true,
						code: true,
						sortOrder: true,
					},
				},
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
			// codeSnippets.language は DB 上は自由入力の text 列のため、
			// 表示側の想定外の値が紛れていても plaintext にフォールバックする
			snippets: recipe.codeSnippets.map((snippet) => ({
				...snippet,
				language: isSnippetLanguage(snippet.language)
					? snippet.language
					: ("plaintext" as const),
			})),
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

		const tagSlugs = await syncRecipeTags(context.db, recipe.id, data.tags);

		if (data.status === "published") {
			await purgeAfterWrite(context.request, {
				recipeSlugs: [data.slug],
				tagSlugs,
			});
		}

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
			columns: {
				id: true,
				authorId: true,
				slug: true,
				publishedAt: true,
				bodyMd: true,
			},
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

		// タグを差し替える前に、旧タグページもキャッシュ破棄の対象に含める
		const previousTagSlugs = await currentTagSlugs(context.db, data.id);

		const recipeUpdateValues = {
			title: data.title,
			slug: data.slug,
			summary: data.summary,
			bodyMd: data.bodyMd,
			status: data.status,
			publishedAt,
			updatedAt: new Date(),
		};

		// 本文が変わる更新だけ、編集前の本文をリビジョンとして残す
		// （誤編集からのロールバック手段。docs/proposal.md §5.1、issue #20）。
		// node-postgres は db.transaction() をサポートするため、Hyperdrive 切り替え
		// 後はこちらを使う（neon-http 時代の db.batch() から変更。issue #22）。
		if (data.bodyMd !== current.bodyMd) {
			await context.db.transaction(async (tx) => {
				await tx.insert(recipeRevisions).values({
					recipeId: data.id,
					bodyMd: current.bodyMd,
				});
				await tx
					.update(recipes)
					.set(recipeUpdateValues)
					.where(eq(recipes.id, data.id));
			});
		} else {
			await context.db
				.update(recipes)
				.set(recipeUpdateValues)
				.where(eq(recipes.id, data.id));
		}

		const tagSlugs = await syncRecipeTags(context.db, data.id, data.tags);

		// slug を変えた場合は旧 URL のキャッシュも破棄する
		await purgeAfterWrite(context.request, {
			recipeSlugs: [data.slug, current.slug],
			tagSlugs: [...previousTagSlugs, ...tagSlugs],
		});

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
			columns: { authorId: true, slug: true },
		});
		if (!current || current.authorId !== session.user.id) {
			throw new Error("レシピが見つかりません");
		}

		const tagSlugs = await currentTagSlugs(context.db, data.id);

		// code_snippets・recipe_tags は ON DELETE CASCADE で追随して削除される
		await context.db.delete(recipes).where(eq(recipes.id, data.id));

		await purgeAfterWrite(context.request, {
			recipeSlugs: [current.slug],
			tagSlugs,
		});
	});
