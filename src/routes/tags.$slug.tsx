import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { RecipeCard } from "../components/recipe/recipe-card";
import {
	getTagBySlug,
	listPublishedRecipes,
} from "../lib/recipes/public-recipes";

interface TagSearch {
	page: number;
}

// TanStack Router は search スキーマの出力型に必須フィールドがあると、
// この route への <Link> すべてで search 指定を必須にする。そのため
// page は呼び出し側で明示的に渡す運用にする（省略はできない）。
function validateSearch(search: Record<string, unknown>): TagSearch {
	const page =
		typeof search.page === "number" &&
		Number.isInteger(search.page) &&
		search.page > 0
			? search.page
			: 1;
	return { page };
}

export const Route = createFileRoute("/tags/$slug")({
	validateSearch,
	loaderDeps: ({ search }) => ({ page: search.page }),
	loader: async ({ params, deps }) => {
		const [tag, result] = await Promise.all([
			getTagBySlug({ data: params.slug }),
			listPublishedRecipes({ data: { tagSlug: params.slug, page: deps.page } }),
		]);
		if (!tag) {
			throw notFound();
		}
		return { tag, ...result };
	},
	head: ({ loaderData }) => ({
		meta: loaderData
			? [{ title: `タグ「${loaderData.tag.name}」 | GAS Recipe Hub` }]
			: [],
	}),
	component: TagPage,
});

function TagPage() {
	const data = Route.useLoaderData();
	const { page } = Route.useSearch();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">タグ「{data.tag.name}」</h1>

			<div className="mt-6 flex flex-col gap-4">
				{data.items.length === 0 ? (
					<p className="text-sm text-gray-500">
						このタグのレシピはまだありません。
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
							to="/tags/$slug"
							params={{ slug: data.tag.slug }}
							search={{ page: page - 1 }}
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
							to="/tags/$slug"
							params={{ slug: data.tag.slug }}
							search={{ page: page + 1 }}
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
