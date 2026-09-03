import { useState } from "react";
import type { CollectionStatus } from "../../lib/collections/validate";
import { slugify } from "../../lib/recipes/slugify";

export interface CollectionFormOutput {
	title: string;
	slug: string;
	description: string;
	status: CollectionStatus;
}

export interface CollectionFormInitialValues {
	title?: string;
	slug?: string;
	description?: string;
	status?: CollectionStatus;
}

interface CollectionFormProps {
	initialValues?: CollectionFormInitialValues;
	submitLabel: string;
	onSubmit: (values: CollectionFormOutput) => Promise<void>;
	extraActions?: React.ReactNode;
}

export function CollectionForm({
	initialValues,
	submitLabel,
	onSubmit,
	extraActions,
}: CollectionFormProps) {
	const [title, setTitle] = useState(initialValues?.title ?? "");
	const [slug, setSlug] = useState(initialValues?.slug ?? "");
	const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.slug));
	const [description, setDescription] = useState(
		initialValues?.description ?? "",
	);
	const [status, setStatus] = useState<CollectionStatus>(
		initialValues?.status ?? "draft",
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function handleTitleChange(value: string) {
		setTitle(value);
		if (!slugTouched) {
			setSlug(slugify(value));
		}
	}

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await onSubmit({ title, slug, description, status });
		} catch (err) {
			setError(err instanceof Error ? err.message : "保存に失敗しました");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="mt-6 flex max-w-2xl flex-col gap-4"
		>
			{error && (
				<p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
			)}

			<label className="flex flex-col gap-1">
				<span className="text-sm font-medium">タイトル</span>
				<input
					required
					className="rounded border px-3 py-2"
					value={title}
					onChange={(e) => handleTitleChange(e.target.value)}
				/>
			</label>

			<label className="flex flex-col gap-1">
				<span className="text-sm font-medium">
					スラッグ（URL に使用。半角英数字とハイフン）
				</span>
				<input
					required
					className="rounded border px-3 py-2 font-mono text-sm"
					value={slug}
					onChange={(e) => {
						setSlugTouched(true);
						setSlug(e.target.value);
					}}
				/>
			</label>

			<label className="flex flex-col gap-1">
				<span className="text-sm font-medium">説明</span>
				<textarea
					className="rounded border px-3 py-2"
					rows={3}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</label>

			<fieldset className="flex gap-4">
				<legend className="text-sm font-medium">状態</legend>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="radio"
						name="status"
						checked={status === "draft"}
						onChange={() => setStatus("draft")}
					/>
					下書き
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input
						type="radio"
						name="status"
						checked={status === "published"}
						onChange={() => setStatus("published")}
					/>
					公開
				</label>
			</fieldset>

			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={submitting}
					className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
				>
					{submitting ? "保存中…" : submitLabel}
				</button>
				{extraActions}
			</div>
		</form>
	);
}
