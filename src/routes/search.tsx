import { createFileRoute, Link } from "@tanstack/react-router";
import { RecipeCard } from "../components/recipe/recipe-card";
import { SearchBox } from "../components/recipe/search-box";
import { SEARCH_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";
import { searchRecipes } from "../lib/recipes/search";
import { seo } from "../lib/seo/site";

interface SearchParams {
	q?: string;
	page: number;
}

// 検索語・ページ番号は URL に保持する。結果 URL を共有すれば同じ結果が
// 再現される（docs/proposal.md §6、issue #17）。
function validateSearch(search: Record<string, unknown>): SearchParams {
	const q = typeof search.q === "string" && search.q ? search.q : undefined;
	const page =
		typeof search.page === "number" &&
		Number.isInteger(search.page) &&
		search.page > 0
			? search.page
			: 1;
	return { q, page };
}

export const Route = createFileRoute("/search")({
	validateSearch,
	loaderDeps: ({ search }) => ({ q: search.q, page: search.page }),
	loader: ({ deps }) => searchRecipes({ data: { q: deps.q, page: deps.page } }),
	headers: () => ({ "cache-control": SEARCH_CACHE_CONTROL }),
	head: ({ loaderData }) =>
		seo({
			title: loaderData?.query
				? `「${loaderData.query}」の検索結果 | GAS Recipe Hub`
				: "レシピ検索 | GAS Recipe Hub",
			description: "GAS のレシピをタイトル・本文・コードから検索できます。",
			path: "/search",
			// 検索結果はクエリごとに無数の URL ができるためインデックスさせない
			noindex: true,
		}),
	component: SearchPage,
});

function SearchPage() {
	const data = Route.useLoaderData();
	const { q, page } = Route.useSearch();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">レシピ検索</h1>

			<div className="mt-4">
				<SearchBox key={q ?? ""} defaultValue={q ?? ""} />
			</div>

			{!data.query ? (
				<p className="mt-6 text-sm text-gray-500">
					キーワードを入力して検索してください（2文字以上）。
				</p>
			) : (
				<>
					<p className="mt-6 text-sm text-gray-500">
						「{data.query}」の検索結果：{data.total} 件
					</p>

					<div className="mt-4 flex flex-col gap-4">
						{data.items.length === 0 ? (
							<p className="text-sm text-gray-500">
								一致するレシピが見つかりませんでした。
							</p>
						) : (
							data.items.map((recipe) => (
								<RecipeCard key={recipe.id} recipe={recipe} />
							))
						)}
					</div>

					{data.totalPages > 1 && (
						<nav className="mt-8 flex items-center justify-center gap-4 text-sm">
							{page > 1 ? (
								<Link
									to="/search"
									search={{ q, page: page - 1 }}
									className="underline"
								>
									← 前へ
								</Link>
							) : (
								<span className="text-gray-300">← 前へ</span>
							)}
							<span>
								{data.page} / {data.totalPages}
							</span>
							{page < data.totalPages ? (
								<Link
									to="/search"
									search={{ q, page: page + 1 }}
									className="underline"
								>
									次へ →
								</Link>
							) : (
								<span className="text-gray-300">次へ →</span>
							)}
						</nav>
					)}
				</>
			)}
		</div>
	);
}
