import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { RecipeForm } from "../components/admin/recipe-form";
import { SnippetManager } from "../components/admin/snippet-manager";
import {
	adminDeleteRecipe,
	adminGetRecipe,
	adminUpdateRecipe,
} from "../lib/recipes/admin-recipes";

export const Route = createFileRoute("/admin/recipes/$id/edit")({
	loader: async ({ params }) => {
		const recipe = await adminGetRecipe({ data: params.id });
		if (!recipe) {
			throw notFound();
		}
		return recipe;
	},
	component: EditRecipePage,
});

function EditRecipePage() {
	const recipe = Route.useLoaderData();
	const navigate = useNavigate();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">レシピを編集</h1>
			<RecipeForm
				submitLabel="保存する"
				initialValues={{
					title: recipe.title,
					slug: recipe.slug,
					summary: recipe.summary,
					bodyMd: recipe.bodyMd,
					status: recipe.status,
					tags: recipe.tags,
				}}
				onSubmit={async (values) => {
					await adminUpdateRecipe({ data: { id: recipe.id, ...values } });
				}}
				extraActions={
					<button
						type="button"
						className="text-red-600 underline"
						onClick={async () => {
							if (
								!window.confirm(
									`「${recipe.title}」を削除しますか？この操作は取り消せません。`,
								)
							) {
								return;
							}
							try {
								await adminDeleteRecipe({ data: { id: recipe.id } });
								await navigate({ to: "/admin" });
							} catch (err) {
								window.alert(
									err instanceof Error ? err.message : "削除に失敗しました",
								);
							}
						}}
					>
						削除
					</button>
				}
			/>

			<SnippetManager recipeId={recipe.id} initialSnippets={recipe.snippets} />
		</div>
	);
}
