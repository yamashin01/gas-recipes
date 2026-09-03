import { createServerFn } from "@tanstack/react-start";
import {
	and,
	count,
	desc,
	eq,
	exists,
	ilike,
	inArray,
	or,
	sql,
} from "drizzle-orm";
import { codeSnippets, recipes, recipeTags, tags } from "../../db/schema";
import { PUBLISHED, RECIPES_PAGE_SIZE } from "./public-recipes";
import { normalizeSearchQuery, toLikePattern } from "./search-query";

// pg_trgm によるレシピ検索（docs/proposal.md §5.2、issue #17）。
//
// Neon では日本語の形態素解析拡張が使えないため、MVP は pg_trgm だけで組む。
//   - 部分一致：ILIKE '%クエリ%'（gin_trgm_ops 索引が効く）
//   - 表記ゆれ：pg_trgm の類似度演算子 `%`（同じ索引が効く。閾値は
//     pg_trgm.similarity_threshold のデフォルト 0.3）
// `%` 演算子は短いテキスト同士の比較を前提とした指標のため、本文・コードの
// ような長文には適用せず、タイトル・要約にのみ用いる。長文は部分一致で拾う。
//
// tsvector（recipes.search_vector）との併用は、精度不足が実運用で確認できて
// から追加する（docs/architecture.md §3-4）。

/** 一致箇所ごとの重み。タイトル一致を最上位に、本文・コード一致を下位に置く。 */
const WEIGHT_TITLE = 3;
const WEIGHT_SUMMARY = 2;
const WEIGHT_BODY = 1;
const WEIGHT_CODE = 1;
/** 同順位内での並びを決める類似度スコアの重み。 */
const WEIGHT_TITLE_SIMILARITY = 2;
const WEIGHT_SUMMARY_SIMILARITY = 1;

export interface SearchResultItem {
	id: string;
	slug: string;
	title: string;
	summary: string;
	publishedAt: Date | null;
	tags: { slug: string; name: string }[];
}

export interface SearchResult {
	query: string;
	items: SearchResultItem[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export const searchRecipes = createServerFn({ method: "GET" })
	.validator((input: unknown) => {
		const raw = (input ?? {}) as { q?: unknown; page?: unknown };
		const page =
			typeof raw.page === "number" && Number.isInteger(raw.page) && raw.page > 0
				? raw.page
				: 1;
		return { q: normalizeSearchQuery(raw.q), page };
	})
	.handler(async ({ data, context }): Promise<SearchResult> => {
		const query = data.q;
		if (!query) {
			return {
				query: "",
				items: [],
				total: 0,
				page: 1,
				pageSize: RECIPES_PAGE_SIZE,
				totalPages: 1,
			};
		}

		const pattern = toLikePattern(query);
		const db = context.db;

		const titleMatch = ilike(recipes.title, pattern);
		const summaryMatch = ilike(recipes.summary, pattern);
		const bodyMatch = ilike(recipes.bodyMd, pattern);
		const codeMatch = exists(
			db
				.select({ one: sql`1` })
				.from(codeSnippets)
				.where(
					and(
						eq(codeSnippets.recipeId, recipes.id),
						ilike(codeSnippets.code, pattern),
					),
				),
		);
		// 類似度演算子。左右どちらも gin_trgm_ops 索引の対象になる。
		const titleSimilar = sql`${recipes.title} % ${query}`;
		const summarySimilar = sql`${recipes.summary} % ${query}`;

		const where = and(
			PUBLISHED,
			or(
				titleMatch,
				summaryMatch,
				bodyMatch,
				codeMatch,
				titleSimilar,
				summarySimilar,
			),
		);

		const score = sql<number>`
			${WEIGHT_TITLE} * (case when ${titleMatch} then 1 else 0 end)
			+ ${WEIGHT_SUMMARY} * (case when ${summaryMatch} then 1 else 0 end)
			+ ${WEIGHT_BODY} * (case when ${bodyMatch} then 1 else 0 end)
			+ ${WEIGHT_CODE} * (case when ${codeMatch} then 1 else 0 end)
			+ ${WEIGHT_TITLE_SIMILARITY} * similarity(${recipes.title}, ${query})
			+ ${WEIGHT_SUMMARY_SIMILARITY} * similarity(${recipes.summary}, ${query})
		`;

		const offset = (data.page - 1) * RECIPES_PAGE_SIZE;

		const [rows, [{ total }]] = await Promise.all([
			db
				.select({
					id: recipes.id,
					slug: recipes.slug,
					title: recipes.title,
					summary: recipes.summary,
					publishedAt: recipes.publishedAt,
				})
				.from(recipes)
				.where(where)
				.orderBy(desc(score), desc(recipes.publishedAt))
				.limit(RECIPES_PAGE_SIZE)
				.offset(offset),
			db.select({ total: count() }).from(recipes).where(where),
		]);

		// タグは件数が確定してから1クエリでまとめて引く（レシピごとの N+1 を避ける）
		const recipeIds = rows.map((row) => row.id);
		const tagRows = recipeIds.length
			? await db
					.select({
						recipeId: recipeTags.recipeId,
						slug: tags.slug,
						name: tags.name,
					})
					.from(recipeTags)
					.innerJoin(tags, eq(tags.id, recipeTags.tagId))
					.where(inArray(recipeTags.recipeId, recipeIds))
			: [];

		const tagsByRecipeId = new Map<string, { slug: string; name: string }[]>();
		for (const row of tagRows) {
			const list = tagsByRecipeId.get(row.recipeId) ?? [];
			list.push({ slug: row.slug, name: row.name });
			tagsByRecipeId.set(row.recipeId, list);
		}

		return {
			query,
			items: rows.map((row) => ({
				...row,
				tags: tagsByRecipeId.get(row.id) ?? [],
			})),
			total,
			page: data.page,
			pageSize: RECIPES_PAGE_SIZE,
			totalPages: Math.max(1, Math.ceil(total / RECIPES_PAGE_SIZE)),
		};
	});
