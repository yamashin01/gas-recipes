import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { CollectionForm } from "../components/admin/collection-form";
import { CollectionItemManager } from "../components/admin/collection-item-manager";
import {
	adminDeleteCollection,
	adminGetCollection,
	adminUpdateCollection,
} from "../lib/collections/admin-collections";
import { adminListRecipes } from "../lib/recipes/admin-recipes";

export const Route = createFileRoute("/admin/collections/$id/edit")({
	loader: async ({ params }) => {
		const [collection, recipes] = await Promise.all([
			adminGetCollection({ data: params.id }),
			adminListRecipes(),
		]);
		if (!collection) {
			throw notFound();
		}
		return { collection, recipes };
	},
	component: EditCollectionPage,
});

function EditCollectionPage() {
	const { collection, recipes } = Route.useLoaderData();
	const navigate = useNavigate();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">コレクションを編集</h1>
			<CollectionForm
				key={collection.id}
				submitLabel="保存する"
				initialValues={{
					title: collection.title,
					slug: collection.slug,
					description: collection.description,
					status: collection.status,
				}}
				onSubmit={async (values) => {
					await adminUpdateCollection({
						data: { id: collection.id, ...values },
					});
				}}
				extraActions={
					<button
						type="button"
						className="text-red-600 underline"
						onClick={async () => {
							if (
								!window.confirm(
									`「${collection.title}」を削除しますか？この操作は取り消せません。`,
								)
							) {
								return;
							}
							try {
								await adminDeleteCollection({ data: { id: collection.id } });
								await navigate({ to: "/admin/collections" });
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

			<CollectionItemManager
				key={collection.id}
				collectionId={collection.id}
				initialItems={collection.items}
				candidateRecipes={recipes.map((recipe) => ({
					id: recipe.id,
					title: recipe.title,
				}))}
			/>
		</div>
	);
}
