import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CollectionForm } from "../components/admin/collection-form";
import { adminCreateCollection } from "../lib/collections/admin-collections";

export const Route = createFileRoute("/admin/collections/new")({
	component: NewCollectionPage,
});

function NewCollectionPage() {
	const navigate = useNavigate();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">コレクションを新規作成</h1>
			<CollectionForm
				submitLabel="作成する"
				onSubmit={async (values) => {
					const { id } = await adminCreateCollection({ data: values });
					await navigate({
						to: "/admin/collections/$id/edit",
						params: { id },
					});
				}}
			/>
		</div>
	);
}
