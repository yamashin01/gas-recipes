import { createFileRoute, Link } from "@tanstack/react-router";
import { RecipeCard } from "../components/recipe/recipe-card";
import { SearchBox } from "../components/recipe/search-box";
import { PUBLIC_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";
import type { RecipeSort } from "../lib/recipes/public-recipes";
import {
	getTagBySlug,
	listPublishedRecipes,
} from "../lib/recipes/public-recipes";
import { pathWithQuery, seo } from "../lib/seo/site";

interface RecipesSearch {
	tag?: string;
	sort?: RecipeSort;
	page: number;
}

// TanStack Router は search スキーマの出力型に必須フィールドがあると、
// この route への <Link> すべてで search 指定を必須にする。そのため
// tag・sort は任意のまま、page だけ呼び出し側で明示的に渡す運用にする
// （省略はできない）。
function validateSearch(search: Record<string, unknown>): RecipesSearch {
	const tag =
		typeof search.tag === "string" && search.tag ? search.tag : undefined;
	const sort: RecipeSort | undefined =
		search.sort === "popular" ? "popular" : undefined;
	const page =
		typeof search.page === "number" &&
		Number.isInteger(search.page) &&
		search.page > 0
			? search.page
			: 1;
	return { tag, sort, page };
}

export const Route = createFileRoute("/recipes/")({
	validateSearch,
	loaderDeps: ({ search }) => ({
		tag: search.tag,
		sort: search.sort,
		page: search.page,
	}),
	loader: async ({ deps }) => {
		const [result, tag] = await Promise.all([
			listPublishedRecipes({
				data: { tagSlug: deps.tag, page: deps.page, sort: deps.sort },
			}),
			deps.tag ? getTagBySlug({ data: deps.tag }) : Promise.resolve(null),
		]);
		return { ...result, tag };
	},
	headers: () => ({ "cache-control": PUBLIC_CACHE_CONTROL }),
	head: ({ match }) =>
		seo({
			title: "レシピ一覧 | GAS Recipe Hub",
			description: "GAS の実装パターンをまとめたレシピの一覧です。",
			// ページ送り・タグ絞り込み・並び順は自分自身を canonical にする
			path: pathWithQuery("/recipes", {
				tag: match.search.tag,
				sort: match.search.sort,
				page: match.search.page,
			}),
		}),
	component: RecipesPage,
});

function RecipesPage() {
	const data = Route.useLoaderData();
	const { tag, sort, page } = Route.useSearch();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">レシピ一覧</h1>

			<div className="mt-4">
				<SearchBox />
			</div>

			<div className="mt-4 flex items-center gap-3 text-sm">
				<Link
					to="/recipes"
					search={{ tag, page: 1 }}
					className={sort === "popular" ? "underline" : "font-bold"}
				>
					新着順
				</Link>
				<Link
					to="/recipes"
					search={{ tag, sort: "popular", page: 1 }}
					className={sort === "popular" ? "font-bold" : "underline"}
				>
					人気順
				</Link>
			</div>

			{tag && (
				<p className="mt-2 text-sm text-gray-500">
					タグ「{data.tag?.name ?? tag}」で絞り込み中 -{" "}
					<Link to="/recipes" search={{ page: 1 }} className="underline">
						解除
					</Link>
				</p>
			)}

			<div className="mt-6 flex flex-col gap-4">
				{data.items.length === 0 ? (
					<p className="text-sm text-gray-500">
						レシピが見つかりませんでした。
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
							to="/recipes"
							search={{ tag, sort, page: page - 1 }}
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
							to="/recipes"
							search={{ tag, sort, page: page + 1 }}
							className="underline"
						>
							次へ →
						</Link>
					) : (
						<span className="text-gray-300">次へ →</span>
					)}
				</nav>
			)}
		</div>
	);
}
