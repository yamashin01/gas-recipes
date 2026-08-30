import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CodeBlock } from "../components/recipe/code-block";
import { renderMarkdown } from "../lib/recipes/markdown";
import { getPublishedRecipeBySlug } from "../lib/recipes/public-recipes";

export const Route = createFileRoute("/recipes/$slug")({
	loader: async ({ params }) => {
		const recipe = await getPublishedRecipeBySlug({ data: params.slug });
		if (!recipe) {
			throw notFound();
		}
		return recipe;
	},
	head: ({ loaderData }) => ({
		meta: loaderData
			? [
					{ title: `${loaderData.title} | GAS Recipe Hub` },
					{
						name: "description",
						content: loaderData.summary || loaderData.title,
					},
				]
			: [],
	}),
	component: RecipeDetailPage,
});

function RecipeDetailPage() {
	const recipe = Route.useLoaderData();
	const html = renderMarkdown(recipe.bodyMd);

	return (
		<div className="p-8">
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
		</div>
	);
}
