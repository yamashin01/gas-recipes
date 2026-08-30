import { useState } from "react";
import {
	adminCreateSnippet,
	adminDeleteSnippet,
	adminReorderSnippets,
	adminUpdateSnippet,
} from "../../lib/recipes/admin-snippets";
import type { SnippetLanguage } from "../../lib/recipes/snippet-language";
import { CodeBlock } from "../recipe/code-block";
import type { SnippetFormValues } from "./snippet-form";
import { SnippetForm } from "./snippet-form";

export interface SnippetItem {
	id: string;
	filename: string;
	language: SnippetLanguage;
	code: string;
	sortOrder: number;
}

interface SnippetManagerProps {
	recipeId: string;
	initialSnippets: SnippetItem[];
}

export function SnippetManager({
	recipeId,
	initialSnippets,
}: SnippetManagerProps) {
	const [snippets, setSnippets] = useState(initialSnippets);
	const [error, setError] = useState<string | null>(null);

	async function handleReorder(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= snippets.length) return;

		const previous = snippets;
		const reordered = [...snippets];
		const [moved] = reordered.splice(index, 1);
		reordered.splice(target, 0, moved);
		setSnippets(reordered);
		setError(null);

		try {
			await adminReorderSnippets({
				data: { recipeId, orderedIds: reordered.map((s) => s.id) },
			});
		} catch (err) {
			setSnippets(previous);
			setError(err instanceof Error ? err.message : "並び替えに失敗しました");
		}
	}

	async function handleDelete(id: string) {
		if (!window.confirm("このスニペットを削除しますか？")) return;
		setError(null);
		try {
			await adminDeleteSnippet({ data: { id } });
			setSnippets((prev) => prev.filter((s) => s.id !== id));
		} catch (err) {
			setError(err instanceof Error ? err.message : "削除に失敗しました");
		}
	}

	async function handleUpdate(id: string, values: SnippetFormValues) {
		setError(null);
		await adminUpdateSnippet({ data: { id, ...values } });
		setSnippets((prev) =>
			prev.map((s) => (s.id === id ? { ...s, ...values } : s)),
		);
	}

	async function handleCreate(values: SnippetFormValues) {
		setError(null);
		const created = await adminCreateSnippet({ data: { recipeId, ...values } });
		setSnippets((prev) => [...prev, created]);
	}

	return (
		<div className="mt-10 max-w-2xl">
			<h2 className="text-lg font-bold">コードスニペット</h2>
			{error && (
				<p className="mt-2 rounded bg-red-50 p-3 text-sm text-red-700">
					{error}
				</p>
			)}

			<div className="mt-4 flex flex-col gap-6">
				{snippets.map((snippet, index) => (
					<SnippetRow
						key={snippet.id}
						snippet={snippet}
						canMoveUp={index > 0}
						canMoveDown={index < snippets.length - 1}
						onMoveUp={() => handleReorder(index, -1)}
						onMoveDown={() => handleReorder(index, 1)}
						onSave={(values) => handleUpdate(snippet.id, values)}
						onDelete={() => handleDelete(snippet.id)}
					/>
				))}
			</div>

			<div className="mt-6">
				<h3 className="mb-2 text-sm font-medium">スニペットを追加</h3>
				<SnippetForm submitLabel="追加する" onSubmit={handleCreate} />
			</div>
		</div>
	);
}

interface SnippetRowProps {
	snippet: SnippetItem;
	canMoveUp: boolean;
	canMoveDown: boolean;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onSave: (values: SnippetFormValues) => Promise<void>;
	onDelete: () => void;
}

function SnippetRow({
	snippet,
	canMoveUp,
	canMoveDown,
	onMoveUp,
	onMoveDown,
	onSave,
	onDelete,
}: SnippetRowProps) {
	const [editing, setEditing] = useState(false);

	if (editing) {
		return (
			<SnippetForm
				initialValues={snippet}
				submitLabel="保存する"
				onCancel={() => setEditing(false)}
				onSubmit={async (values) => {
					await onSave(values);
					setEditing(false);
				}}
			/>
		);
	}

	return (
		<div>
			<div className="mb-2 flex items-center justify-end gap-3 text-sm">
				<button
					type="button"
					disabled={!canMoveUp}
					onClick={onMoveUp}
					className="disabled:opacity-30"
					aria-label="上に移動"
				>
					↑
				</button>
				<button
					type="button"
					disabled={!canMoveDown}
					onClick={onMoveDown}
					className="disabled:opacity-30"
					aria-label="下に移動"
				>
					↓
				</button>
				<button
					type="button"
					onClick={() => setEditing(true)}
					className="underline"
				>
					編集
				</button>
				<button
					type="button"
					onClick={onDelete}
					className="text-red-600 underline"
				>
					削除
				</button>
			</div>
			<CodeBlock
				filename={snippet.filename}
				language={snippet.language}
				code={snippet.code}
			/>
		</div>
	);
}
