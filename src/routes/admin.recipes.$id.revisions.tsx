import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { adminGetRecipe } from "../lib/recipes/admin-recipes";
import {
	adminListRecipeRevisions,
	adminRollbackRecipeRevision,
} from "../lib/recipes/admin-revisions";

export const Route = createFileRoute("/admin/recipes/$id/revisions")({
	loader: async ({ params }) => {
		const [recipe, revisions] = await Promise.all([
			adminGetRecipe({ data: params.id }),
			adminListRecipeRevisions({ data: params.id }),
		]);
		if (!recipe) {
			throw notFound();
		}
		return { recipe, revisions };
	},
	component: RecipeRevisionsPage,
});

function RecipeRevisionsPage() {
	const { recipe, revisions } = Route.useLoaderData();
	const router = useRouter();
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleRollback(revisionId: string) {
		if (
			!window.confirm(
				"このバージョンの本文に復元しますか？現在の本文は新しいリビジョンとして残ります。",
			)
		) {
			return;
		}
		setError(null);
		setPendingId(revisionId);
		try {
			await adminRollbackRecipeRevision({
				data: { recipeId: recipe.id, revisionId },
			});
			await router.invalidate();
		} catch (err) {
			setError(err instanceof Error ? err.message : "復元に失敗しました");
		} finally {
			setPendingId(null);
		}
	}

	return (
		<div className="p-8">
			<Link
				to="/admin/recipes/$id/edit"
				params={{ id: recipe.id }}
				className="text-sm underline"
			>
				← 編集画面に戻る
			</Link>
			<h1 className="mt-2 text-2xl font-bold">
				リビジョン履歴：{recipe.title}
			</h1>

			{error && (
				<p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
					{error}
				</p>
			)}

			{revisions.length === 0 ? (
				<p className="mt-6 text-sm text-gray-500">
					このレシピはまだ本文を更新していません。
				</p>
			) : (
				<ul className="mt-6 flex flex-col gap-4">
					{revisions.map((revision) => {
						const expanded = expandedId === revision.id;
						return (
							<li key={revision.id} className="rounded border p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-gray-500">
										{new Date(revision.createdAt).toLocaleString("ja-JP")}
									</span>
									<div className="flex items-center gap-3 text-sm">
										<button
											type="button"
											className="underline"
											onClick={() =>
												setExpandedId(expanded ? null : revision.id)
											}
										>
											{expanded ? "本文を隠す" : "本文を表示"}
										</button>
										<button
											type="button"
											disabled={pendingId === revision.id}
											className="text-blue-600 underline disabled:opacity-50"
											onClick={() => handleRollback(revision.id)}
										>
											このバージョンを復元
										</button>
									</div>
								</div>
								{expanded && (
									<pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
										{revision.bodyMd}
									</pre>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
