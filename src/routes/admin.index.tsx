import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	adminDeleteRecipe,
	adminListRecipes,
} from "../lib/recipes/admin-recipes";

export const Route = createFileRoute("/admin/")({
	loader: () => adminListRecipes(),
	component: AdminDashboard,
});

function AdminDashboard() {
	const recipes = Route.useLoaderData();
	const router = useRouter();
	const [pendingId, setPendingId] = useState<string | null>(null);

	async function handleDelete(id: string, title: string) {
		if (
			!window.confirm(`「${title}」を削除しますか？この操作は取り消せません。`)
		) {
			return;
		}
		setPendingId(id);
		try {
			await adminDeleteRecipe({ data: { id } });
			await router.invalidate();
		} finally {
			setPendingId(null);
		}
	}

	return (
		<div className="p-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">管理ダッシュボード</h1>
				<Link
					to="/admin/recipes/new"
					className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
				>
					新規作成
				</Link>
			</div>

			{recipes.length === 0 ? (
				<p className="mt-6 text-sm text-gray-500">レシピがまだありません。</p>
			) : (
				<table className="mt-6 w-full border-collapse text-sm">
					<thead>
						<tr className="border-b text-left">
							<th className="py-2">タイトル</th>
							<th className="py-2">状態</th>
							<th className="py-2">タグ</th>
							<th className="py-2">更新日</th>
							<th className="py-2" />
						</tr>
					</thead>
					<tbody>
						{recipes.map((recipe) => (
							<tr key={recipe.id} className="border-b">
								<td className="py-2">{recipe.title}</td>
								<td className="py-2">
									<span
										className={
											recipe.status === "published"
												? "text-green-700"
												: "text-gray-500"
										}
									>
										{recipe.status === "published" ? "公開中" : "下書き"}
									</span>
								</td>
								<td className="py-2">{recipe.tags.join(", ")}</td>
								<td className="py-2">
									{new Date(recipe.updatedAt).toLocaleDateString("ja-JP")}
								</td>
								<td className="py-2 text-right">
									<div className="flex justify-end gap-3">
										<Link
											to="/admin/recipes/$id/edit"
											params={{ id: recipe.id }}
											className="underline"
										>
											編集
										</Link>
										<button
											type="button"
											className="text-red-600 underline disabled:opacity-50"
											disabled={pendingId === recipe.id}
											onClick={() => handleDelete(recipe.id, recipe.title)}
										>
											削除
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
