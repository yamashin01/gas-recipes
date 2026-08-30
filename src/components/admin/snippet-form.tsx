import { useState } from "react";

export interface SnippetFormValues {
	filename: string;
	language: string;
	code: string;
}

const LANGUAGE_OPTIONS = [
	{ value: "javascript", label: "JavaScript" },
	{ value: "json", label: "JSON" },
	{ value: "plaintext", label: "プレーンテキスト" },
];

interface SnippetFormProps {
	initialValues?: SnippetFormValues;
	submitLabel: string;
	onSubmit: (values: SnippetFormValues) => Promise<void>;
	onCancel?: () => void;
}

export function SnippetForm({
	initialValues,
	submitLabel,
	onSubmit,
	onCancel,
}: SnippetFormProps) {
	const [filename, setFilename] = useState(
		initialValues?.filename ?? "Code.gs",
	);
	const [language, setLanguage] = useState(
		initialValues?.language ?? "javascript",
	);
	const [code, setCode] = useState(initialValues?.code ?? "");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			await onSubmit({ filename, language, code });
			if (!initialValues) {
				setFilename("Code.gs");
				setLanguage("javascript");
				setCode("");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "保存に失敗しました");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col gap-3 rounded border p-4"
		>
			{error && (
				<p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
			)}

			<div className="flex gap-3">
				<label className="flex flex-1 flex-col gap-1">
					<span className="text-sm font-medium">ファイル名</span>
					<input
						required
						className="rounded border px-3 py-2 font-mono text-sm"
						value={filename}
						onChange={(e) => setFilename(e.target.value)}
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-sm font-medium">言語</span>
					<select
						className="rounded border px-3 py-2 text-sm"
						value={language}
						onChange={(e) => setLanguage(e.target.value)}
					>
						{LANGUAGE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
			</div>

			<label className="flex flex-col gap-1">
				<span className="text-sm font-medium">コード</span>
				<textarea
					required
					rows={10}
					className="rounded border px-3 py-2 font-mono text-sm"
					value={code}
					onChange={(e) => setCode(e.target.value)}
				/>
			</label>

			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={submitting}
					className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
				>
					{submitting ? "保存中…" : submitLabel}
				</button>
				{onCancel && (
					<button
						type="button"
						onClick={onCancel}
						className="text-sm text-gray-600 underline"
					>
						キャンセル
					</button>
				)}
			</div>
		</form>
	);
}
