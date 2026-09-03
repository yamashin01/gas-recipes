import { desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { recipes, recipeTags, tags } from "../../db/schema";
import { PUBLISHED } from "../recipes/public-recipes";

// sitemap.xml / robots.txt の組み立て（issue #18）。
// XML の生成は DB に依存しない純粋な関数に分け、ユニットテストの対象にする。

export interface SitemapEntry {
	path: string;
	lastModified?: Date | null;
	changeFrequency?: "daily" | "weekly" | "monthly";
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export function buildSitemapXml(
	origin: string,
	entries: SitemapEntry[],
): string {
	const urls = entries
		.map((entry) => {
			const loc = escapeXml(new URL(entry.path, origin).toString());
			const lastmod = entry.lastModified
				? `\n    <lastmod>${entry.lastModified.toISOString()}</lastmod>`
				: "";
			const changefreq = entry.changeFrequency
				? `\n    <changefreq>${entry.changeFrequency}</changefreq>`
				: "";
			return `  <url>\n    <loc>${loc}</loc>${lastmod}${changefreq}\n  </url>`;
		})
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function buildRobotsTxt(origin: string): string {
	// 管理画面・認証エンドポイント・検索結果はインデックス対象外
	return `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /search

Sitemap: ${new URL("/sitemap.xml", origin).toString()}
`;
}

/** 公開ページ（トップ・一覧・レシピ詳細・タグ）のサイトマップ項目を集める。 */
export async function collectSitemapEntries(db: Db): Promise<SitemapEntry[]> {
	const [publishedRecipes, tagRows] = await Promise.all([
		db
			.select({ slug: recipes.slug, updatedAt: recipes.updatedAt })
			.from(recipes)
			.where(PUBLISHED)
			.orderBy(desc(recipes.updatedAt)),
		// 公開レシピが1件も紐づかないタグは一覧が空になるため載せない
		db
			.selectDistinct({ slug: tags.slug })
			.from(tags)
			.innerJoin(recipeTags, eq(recipeTags.tagId, tags.id))
			.innerJoin(recipes, eq(recipes.id, recipeTags.recipeId))
			.where(PUBLISHED),
	]);

	const latestUpdate = publishedRecipes[0]?.updatedAt ?? null;

	return [
		{ path: "/", lastModified: latestUpdate, changeFrequency: "daily" },
		{ path: "/recipes", lastModified: latestUpdate, changeFrequency: "daily" },
		...publishedRecipes.map((recipe) => ({
			path: `/recipes/${encodeURIComponent(recipe.slug)}`,
			lastModified: recipe.updatedAt,
			changeFrequency: "monthly" as const,
		})),
		...tagRows.map((tag) => ({
			path: `/tags/${encodeURIComponent(tag.slug)}`,
			lastModified: latestUpdate,
			changeFrequency: "weekly" as const,
		})),
	];
}
