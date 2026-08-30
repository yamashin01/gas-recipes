import { createFileRoute, Link } from "@tanstack/react-router";
import { RecipeCard } from "../components/recipe/recipe-card";
import { SearchBox } from "../components/recipe/search-box";
import { PUBLIC_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";
import {
	getTagBySlug,
	listPublishedRecipes,
} from "../lib/recipes/public-recipes";
import { pathWithQuery, seo } from "../lib/seo/site";

interface RecipesSearch {
	tag?: string;
	page: number;
}

// TanStack Router は search スキーマの出力型に必須フィールドがあると、
// この route への <Link> すべてで search 指定を必須にする。そのため
// tag・page とも呼び出し側で明示的に渡す運用にする（省略はできない）。
function validateSearch(search: Record<string, unknown>): RecipesSearch {
	const tag =
		typeof search.tag === "string" && search.tag ? search.tag : undefined;
	const page =
		typeof search.page === "number" &&
		Number.isInteger(search.page) &&
		search.page > 0
			? search.page
			: 1;
	return { tag, page };
}

export const Route = createFileRoute("/recipes/")({
	validateSearch,
	loaderDeps: ({ search }) => ({ tag: search.tag, page: search.page }),
	loader: async ({ deps }) => {
		const [result, tag] = await Promise.all([
			listPublishedRecipes({ data: { tagSlug: deps.tag, page: deps.page } }),
			deps.tag ? getTagBySlug({ data: deps.tag }) : Promise.resolve(null),
		]);
		return { ...result, tag };
	},
	headers: () => ({ "cache-control": PUBLIC_CACHE_CONTROL }),
	head: ({ match }) =>
		seo({
			title: "レシピ一覧 | GAS Recipe Hub",
			description: "GAS の実装パターンをまとめたレシピの一覧です。",
			// ページ送り・タグ絞り込みは自分自身を canonical にする
			path: pathWithQuery("/recipes", {
				tag: match.search.tag,
				page: match.search.page,
			}),
		}),
	component: RecipesPage,
});

function RecipesPage() {
	const data = Route.useLoaderData();
	const { tag, page } = Route.useSearch();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">レシピ一覧</h1>

			<div className="mt-4">
				<SearchBox />
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
							search={{ tag, page: page - 1 }}
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
							search={{ tag, page: page + 1 }}
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
