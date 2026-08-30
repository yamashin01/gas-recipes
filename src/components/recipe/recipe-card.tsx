import { Link } from "@tanstack/react-router";

export interface RecipeSummary {
	id: string;
	slug: string;
	title: string;
	summary: string;
	publishedAt: Date | string | null;
	tags: { slug: string; name: string }[];
}

interface RecipeCardProps {
	recipe: RecipeSummary;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
	return (
		<article className="rounded border p-4">
			<h2 className="text-lg font-bold">
				<Link
					to="/recipes/$slug"
					params={{ slug: recipe.slug }}
					className="hover:underline"
				>
					{recipe.title}
				</Link>
			</h2>
			{recipe.summary && (
				<p className="mt-1 text-sm text-gray-600">{recipe.summary}</p>
			)}
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
		</article>
	);
}
