import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { CodeBlock } from "../components/recipe/code-block";
import { PUBLIC_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";
import { getCollectionNavigation } from "../lib/collections/public-collections";
import { renderMarkdown } from "../lib/recipes/markdown";
import { getPublishedRecipeBySlug } from "../lib/recipes/public-recipes";
import { seo } from "../lib/seo/site";
import { recordView } from "../lib/views/record-view";

interface RecipeSearch {
	collection?: string;
}

// tags.$slug.tsx と同じ理由で、必須にすると全ての <Link to="/recipes/$slug">
// で search 指定が必要になる。collection はコレクション経由の閲覧時のみ
// 付与される任意パラメータなので optional にする。
function validateSearch(search: Record<string, unknown>): RecipeSearch {
	const collection =
		typeof search.collection === "string" && search.collection
			? search.collection
			: undefined;
	return collection ? { collection } : {};
}

export const Route = createFileRoute("/recipes/$slug")({
	validateSearch,
	loaderDeps: ({ search }) => ({ collection: search.collection }),
	loader: async ({ params, deps }) => {
		// コレクション経由で開いた場合のみ前後ナビゲーション用のデータを取る。
		// getCollectionNavigation は recipe の結果に依存しないため、直列に
		// 待たず並列に呼ぶ（PRレビュー指摘）。
		const [recipe, navigation] = await Promise.all([
			getPublishedRecipeBySlug({ data: params.slug }),
			deps.collection
				? getCollectionNavigation({
						data: { collectionSlug: deps.collection, recipeSlug: params.slug },
					})
				: Promise.resolve(null),
		]);
		if (!recipe) {
			throw notFound();
		}
		return { recipe, navigation };
	},
	headers: () => ({ "cache-control": PUBLIC_CACHE_CONTROL }),
	head: ({ loaderData, params }) =>
		loaderData
			? seo({
					title: `${loaderData.recipe.title} | GAS Recipe Hub`,
					description: loaderData.recipe.summary || loaderData.recipe.title,
					path: `/recipes/${encodeURIComponent(params.slug)}`,
					type: "article",
				})
			: {},
	component: RecipeDetailPage,
});

function RecipeDetailPage() {
	const { recipe, navigation } = Route.useLoaderData();
	const html = renderMarkdown(recipe.bodyMd);

	// マウント時（＝実際に開いたとき）だけ記録する。ホバーによる loader の
	// preload では呼ばれない（recordView 側のコメント参照。PRレビュー指摘）。
	const recordedRecipeId = useRef<string | null>(null);
	useEffect(() => {
		if (recordedRecipeId.current === recipe.id) return;
		recordedRecipeId.current = recipe.id;
		recordView({ data: recipe.id }).catch(() => {});
	}, [recipe.id]);

	return (
		<div className="p-8">
			{navigation && (
				<p className="mb-4 text-sm text-gray-500">
					シリーズ：
					<Link
						to="/collections/$slug"
						params={{ slug: navigation.collection.slug }}
						className="ml-1 underline"
					>
						{navigation.collection.title}
					</Link>
				</p>
			)}

			<h1 className="text-2xl font-bold">{recipe.title}</h1>

			{recipe.tags.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-2">
					{recipe.tags.map((tag) => (
						<Link
							key={tag.slug}
							to="/tags/$slug"
							params={{ slug: tag.slug }}
							search={{ page: 1 }}
							className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
						>
							{tag.name}
						</Link>
					))}
				</div>
			)}

			{recipe.publishedAt && (
				<p className="mt-2 text-xs text-gray-400">
					{new Date(recipe.publishedAt).toLocaleDateString("ja-JP")}
				</p>
			)}

			<div
				className="mt-6"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: 管理者のみが書き込める本文の Markdown レンダリング結果（renderMarkdown 参照）
				dangerouslySetInnerHTML={{ __html: html }}
			/>

			{recipe.snippets.length > 0 && (
				<div className="mt-8 flex flex-col gap-4">
					<h2 className="text-lg font-bold">コードスニペット</h2>
					{recipe.snippets.map((snippet) => (
						<CodeBlock
							key={snippet.id}
							filename={snippet.filename}
							language={snippet.language}
							code={snippet.code}
						/>
					))}
				</div>
			)}

			{navigation && (
				<nav className="mt-8 flex items-center justify-between gap-4 text-sm">
					{navigation.prev ? (
						<Link
							to="/recipes/$slug"
							params={{ slug: navigation.prev.slug }}
							search={{ collection: navigation.collection.slug }}
							className="underline"
						>
							← {navigation.prev.title}
						</Link>
					) : (
						<span />
					)}
					{navigation.next ? (
						<Link
							to="/recipes/$slug"
							params={{ slug: navigation.next.slug }}
							search={{ collection: navigation.collection.slug }}
							className="underline"
						>
							{navigation.next.title} →
						</Link>
					) : (
						<span />
					)}
				</nav>
			)}
		</div>
	);
}
