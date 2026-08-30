import { useState } from "react";
import { slugify } from "../../lib/recipes/slugify";
import type { RecipeStatus } from "../../lib/recipes/validate";

export interface RecipeFormOutput {
	title: string;
	slug: string;
	summary: string;
	bodyMd: string;
	status: RecipeStatus;
	tags: string[];
}

export interface RecipeFormInitialValues {
	title?: string;
	slug?: string;
	summary?: string;
	bodyMd?: string;
	status?: RecipeStatus;
	tags?: string[];
}

interface RecipeFormProps {
	initialValues?: RecipeFormInitialValues;
	submitLabel: string;
	onSubmit: (values: RecipeFormOutput) => Promise<void>;
	extraActions?: React.ReactNode;
}

export function RecipeForm({
	initialValues,
	submitLabel,
	onSubmit,
	extraActions,
}: RecipeFormProps) {
	const [title, setTitle] = useState(initialValues?.title ?? "");
	const [slug, setSlug] = useState(initialValues?.slug ?? "");
	const [slugTouched, setSlugTouched] = useState(Boolean(initialValues?.slug));
	const [summary, setSummary] = useState(initialValues?.summary ?? "");
	const [bodyMd, setBodyMd] = useState(initialValues?.bodyMd ?? "");
	const [status, setStatus] = useState<RecipeStatus>(
		initialValues?.status ?? "draft",
	);
	const [tagsInput, setTagsInput] = useState(
		initialValues?.tags?.join(", ") ?? "",
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
			await onSubmit({
				title,
				slug,
				summary,
				bodyMd,
				status,
				tags: tagsInput
					.split(",")
					.map((tag) => tag.trim())
					.filter(Boolean),
			});
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
				<span className="text-sm font-medium">概要（一覧・OGP 用）</span>
				<textarea
					className="rounded border px-3 py-2"
					rows={2}
					value={summary}
					onChange={(e) => setSummary(e.target.value)}
				/>
			</label>

			<label className="flex flex-col gap-1">
				<span className="text-sm font-medium">本文（Markdown）</span>
				<textarea
					required
					className="rounded border px-3 py-2 font-mono text-sm"
					rows={16}
					value={bodyMd}
					onChange={(e) => setBodyMd(e.target.value)}
				/>
			</label>

			<label className="flex flex-col gap-1">
				<span className="text-sm font-medium">タグ（カンマ区切り）</span>
				<input
					className="rounded border px-3 py-2"
					placeholder="スプレッドシート, GmailApp"
					value={tagsInput}
					onChange={(e) => setTagsInput(e.target.value)}
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
