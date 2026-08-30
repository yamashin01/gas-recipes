import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RecipeForm } from "../components/admin/recipe-form";
import { adminCreateRecipe } from "../lib/recipes/admin-recipes";

export const Route = createFileRoute("/admin/recipes/new")({
	component: NewRecipePage,
});

function NewRecipePage() {
	const navigate = useNavigate();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">レシピを新規作成</h1>
			<RecipeForm
				submitLabel="作成する"
				onSubmit={async (values) => {
					const { id } = await adminCreateRecipe({ data: values });
					await navigate({ to: "/admin/recipes/$id/edit", params: { id } });
				}}
			/>
		</div>
	);
}
