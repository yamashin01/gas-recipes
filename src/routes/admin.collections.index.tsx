import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	adminDeleteCollection,
	adminListCollections,
} from "../lib/collections/admin-collections";

export const Route = createFileRoute("/admin/collections/")({
	loader: () => adminListCollections(),
	component: AdminCollectionsPage,
});

function AdminCollectionsPage() {
	const collections = Route.useLoaderData();
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
			await adminDeleteCollection({ data: { id } });
			await router.invalidate();
		} catch (err) {
			window.alert(err instanceof Error ? err.message : "削除に失敗しました");
		} finally {
			setPendingId(null);
		}
	}

	return (
		<div className="p-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold">コレクション管理</h1>
				<div className="flex items-center gap-4">
					<Link to="/admin" className="text-sm underline">
						レシピ管理に戻る
					</Link>
					<Link
						to="/admin/collections/new"
						className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
					>
						新規作成
					</Link>
				</div>
			</div>

			{collections.length === 0 ? (
				<p className="mt-6 text-sm text-gray-500">
					コレクションがまだありません。
				</p>
			) : (
				<table className="mt-6 w-full border-collapse text-sm">
					<thead>
						<tr className="border-b text-left">
							<th className="py-2">タイトル</th>
							<th className="py-2">状態</th>
							<th className="py-2">レシピ数</th>
							<th className="py-2">更新日</th>
							<th className="py-2" />
						</tr>
					</thead>
					<tbody>
						{collections.map((collection) => (
							<tr key={collection.id} className="border-b">
								<td className="py-2">{collection.title}</td>
								<td className="py-2">
									<span
										className={
											collection.status === "published"
												? "text-green-700"
												: "text-gray-500"
										}
									>
										{collection.status === "published" ? "公開中" : "下書き"}
									</span>
								</td>
								<td className="py-2">{collection.itemCount}</td>
								<td className="py-2">
									{new Date(collection.updatedAt).toLocaleDateString("ja-JP")}
								</td>
								<td className="py-2 text-right">
									<div className="flex justify-end gap-3">
										<Link
											to="/admin/collections/$id/edit"
											params={{ id: collection.id }}
											className="underline"
										>
											編集
										</Link>
										<button
											type="button"
											className="text-red-600 underline disabled:opacity-50"
											disabled={pendingId === collection.id}
											onClick={() =>
												handleDelete(collection.id, collection.title)
											}
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
