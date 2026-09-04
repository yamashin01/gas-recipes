import { useMemo, useState } from "react";
import {
	adminAddCollectionItem,
	adminRemoveCollectionItem,
	adminReorderCollectionItems,
} from "../../lib/collections/admin-collections";

export interface CollectionItem {
	recipeId: string;
	title: string;
	status: "draft" | "published";
	sortOrder: number;
}

export interface CandidateRecipe {
	id: string;
	title: string;
}

interface CollectionItemManagerProps {
	collectionId: string;
	initialItems: CollectionItem[];
	candidateRecipes: CandidateRecipe[];
}

export function CollectionItemManager({
	collectionId,
	initialItems,
	candidateRecipes,
}: CollectionItemManagerProps) {
	const [items, setItems] = useState(initialItems);
	const [selectedRecipeId, setSelectedRecipeId] = useState("");
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const availableRecipes = useMemo(() => {
		const usedIds = new Set(items.map((item) => item.recipeId));
		return candidateRecipes.filter((recipe) => !usedIds.has(recipe.id));
	}, [items, candidateRecipes]);

	async function handleAdd() {
		if (!selectedRecipeId) return;
		setError(null);
		setAdding(true);
		try {
			const added = await adminAddCollectionItem({
				data: { collectionId, recipeId: selectedRecipeId },
			});
			setItems((prev) => [...prev, added]);
			setSelectedRecipeId("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "追加に失敗しました");
		} finally {
			setAdding(false);
		}
	}

	async function handleRemove(recipeId: string) {
		if (!window.confirm("このレシピをシリーズから外しますか？")) return;
		setError(null);
		try {
			await adminRemoveCollectionItem({ data: { collectionId, recipeId } });
			setItems((prev) => prev.filter((item) => item.recipeId !== recipeId));
		} catch (err) {
			setError(err instanceof Error ? err.message : "削除に失敗しました");
		}
	}

	async function handleReorder(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= items.length) return;

		const previous = items;
		const reordered = [...items];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(target, 0, moved);
		setItems(reordered);
		setError(null);

		try {
			await adminReorderCollectionItems({
				data: {
					collectionId,
					orderedRecipeIds: reordered.map((item) => item.recipeId),
				},
			});
		} catch (err) {
			setItems(previous);
			setError(err instanceof Error ? err.message : "並び替えに失敗しました");
		}
	}

	return (
		<div className="mt-10 max-w-2xl">
			<h2 className="text-lg font-bold">レシピ</h2>
			{error && (
				<p className="mt-2 rounded bg-red-50 p-3 text-sm text-red-700">
					{error}
				</p>
			)}

			<ol className="mt-4 flex flex-col gap-2">
				{items.length === 0 ? (
					<p className="text-sm text-gray-500">
						レシピがまだ追加されていません。
					</p>
				) : (
					items.map((item, index) => (
						<li
							key={item.recipeId}
							className="flex items-center justify-between rounded border px-3 py-2"
						>
							<span className="text-sm">
								{index + 1}. {item.title}
								{item.status === "draft" && (
									<span className="ml-2 text-xs text-gray-400">（下書き）</span>
								)}
							</span>
							<div className="flex items-center gap-3 text-sm">
								<button
									type="button"
									disabled={index === 0}
									onClick={() => handleReorder(index, -1)}
									className="disabled:opacity-30"
									aria-label="上に移動"
								>
									↑
								</button>
								<button
									type="button"
									disabled={index === items.length - 1}
									onClick={() => handleReorder(index, 1)}
									className="disabled:opacity-30"
									aria-label="下に移動"
								>
									↓
								</button>
								<button
									type="button"
									onClick={() => handleRemove(item.recipeId)}
									className="text-red-600 underline"
								>
									削除
								</button>
							</div>
						</li>
					))
				)}
			</ol>

			<div className="mt-4 flex items-center gap-3">
				<select
					className="rounded border px-3 py-2 text-sm"
					value={selectedRecipeId}
					onChange={(e) => setSelectedRecipeId(e.target.value)}
				>
					<option value="">レシピを選択…</option>
					{availableRecipes.map((recipe) => (
						<option key={recipe.id} value={recipe.id}>
							{recipe.title}
						</option>
					))}
				</select>
				<button
					type="button"
					disabled={!selectedRecipeId || adding}
					onClick={handleAdd}
					className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
				>
					追加
				</button>
			</div>
		</div>
	);
}
