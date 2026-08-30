import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../../db/client";
import { codeSnippets, recipes } from "../../db/schema";
import { requireAdminContext } from "../auth/require-admin";
import { isSnippetLanguage, type SnippetLanguage } from "./snippet-language";

interface SnippetInput {
	filename: string;
	language: SnippetLanguage;
	code: string;
}

function validateSnippetInput(input: unknown): SnippetInput {
	if (typeof input !== "object" || input === null) {
		throw new Error("入力が不正です");
	}
	const raw = input as Record<string, unknown>;

	const filename = typeof raw.filename === "string" ? raw.filename.trim() : "";
	if (!filename) {
		throw new Error("ファイル名は必須です");
	}

	// UI 以外からの呼び出しも想定し、未対応の言語は plaintext に正規化する
	// （highlight.js に未登録の言語が DB に残ると表示と不整合になるため）。
	const rawLanguage =
		typeof raw.language === "string" ? raw.language.trim() : "";
	const language = isSnippetLanguage(rawLanguage) ? rawLanguage : "plaintext";

	const code = typeof raw.code === "string" ? raw.code : "";
	if (!code.trim()) {
		throw new Error("コードは必須です");
	}

	return { filename, language, code };
}

// 所有レシピに属するスニペットかどうかを確認する（他人のレシピへの
// 書き込みを防ぐ。docs/proposal.md §7、issue #15 の方針を踏襲）。
async function assertOwnsSnippet(db: Db, snippetId: string, userId: string) {
	const snippet = await db.query.codeSnippets.findFirst({
		where: eq(codeSnippets.id, snippetId),
		with: { recipe: { columns: { authorId: true } } },
	});
	if (!snippet || snippet.recipe.authorId !== userId) {
		throw new Error("スニペットが見つかりません");
	}
}

async function assertOwnsRecipe(db: Db, recipeId: string, userId: string) {
	const recipe = await db.query.recipes.findFirst({
		where: eq(recipes.id, recipeId),
		columns: { authorId: true },
	});
	if (!recipe || recipe.authorId !== userId) {
		throw new Error("レシピが見つかりません");
	}
}

export const adminCreateSnippet = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { recipeId, ...rest } = input as Record<string, unknown>;
		if (typeof recipeId !== "string" || recipeId.length === 0) {
			throw new Error("recipeId は必須です");
		}
		return { recipeId, ...validateSnippetInput(rest) };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		await assertOwnsRecipe(context.db, data.recipeId, session.user.id);

		const [{ nextSortOrder }] = await context.db
			.select({
				nextSortOrder: sql<number>`coalesce(max(${codeSnippets.sortOrder}), -1) + 1`,
			})
			.from(codeSnippets)
			.where(eq(codeSnippets.recipeId, data.recipeId));

		const [snippet] = await context.db
			.insert(codeSnippets)
			.values({
				recipeId: data.recipeId,
				filename: data.filename,
				language: data.language,
				code: data.code,
				sortOrder: nextSortOrder,
			})
			.returning({
				id: codeSnippets.id,
				filename: codeSnippets.filename,
				code: codeSnippets.code,
				sortOrder: codeSnippets.sortOrder,
			});

		// codeSnippets.language は DB 上は自由入力の text 列のため、
		// insert 時に検証済みの data.language（SnippetLanguage）をそのまま返す
		return { ...snippet, language: data.language };
	});

export const adminUpdateSnippet = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { id, ...rest } = input as Record<string, unknown>;
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return { id, ...validateSnippetInput(rest) };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		await assertOwnsSnippet(context.db, data.id, session.user.id);

		await context.db
			.update(codeSnippets)
			.set({
				filename: data.filename,
				language: data.language,
				code: data.code,
			})
			.where(eq(codeSnippets.id, data.id));
	});

export const adminDeleteSnippet = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		const id = (input as { id?: unknown } | null)?.id;
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("id は必須です");
		}
		return { id };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		await assertOwnsSnippet(context.db, data.id, session.user.id);

		await context.db.delete(codeSnippets).where(eq(codeSnippets.id, data.id));
	});

export const adminReorderSnippets = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		if (typeof input !== "object" || input === null) {
			throw new Error("入力が不正です");
		}
		const { recipeId, orderedIds } = input as Record<string, unknown>;
		if (typeof recipeId !== "string" || recipeId.length === 0) {
			throw new Error("recipeId は必須です");
		}
		if (
			!Array.isArray(orderedIds) ||
			orderedIds.some((id) => typeof id !== "string")
		) {
			throw new Error("orderedIds が不正です");
		}
		return { recipeId, orderedIds: orderedIds as string[] };
	})
	.handler(async ({ data, context }) => {
		const session = await requireAdminContext(context);
		await assertOwnsRecipe(context.db, data.recipeId, session.user.id);

		if (data.orderedIds.length === 0) {
			return;
		}

		const existing = await context.db
			.select({ id: codeSnippets.id })
			.from(codeSnippets)
			.where(eq(codeSnippets.recipeId, data.recipeId));
		const existingIds = new Set(existing.map((row) => row.id));

		// 対象レシピに属さない ID が混ざっていないかを検証してから並び替える
		if (
			data.orderedIds.length !== existingIds.size ||
			!data.orderedIds.every((id) => existingIds.has(id))
		) {
			throw new Error("スニペットの並び替えに失敗しました");
		}

		// neon-http は HTTP 経由のためリクエストごとにオーバーヘッドがある。
		// Promise.all で N 回リクエストするとスニペット数に比例して増えるため、
		// db.batch() で1リクエストにまとめる（db.transaction() 非対応の代替。
		// docs/architecture.md §2、syncRecipeTags と同じ方針）。
		const [firstId, ...restIds] = data.orderedIds;
		await context.db.batch([
			context.db
				.update(codeSnippets)
				.set({ sortOrder: 0 })
				.where(eq(codeSnippets.id, firstId)),
			...restIds.map((id, index) =>
				context.db
					.update(codeSnippets)
					.set({ sortOrder: index + 1 })
					.where(eq(codeSnippets.id, id)),
			),
		]);
	});
