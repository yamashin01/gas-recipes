import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

interface SearchBoxProps {
	/** URL の q に入っている現在の検索語（未検索なら空文字） */
	defaultValue?: string;
}

// 検索語は URL の search params で保持する（docs/proposal.md §6）。
// 送信時に /search へ遷移させ、ページ番号は 1 に戻す。
export function SearchBox({ defaultValue = "" }: SearchBoxProps) {
	const navigate = useNavigate();
	const [value, setValue] = useState(defaultValue);

	return (
		<form
			className="flex gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				const q = value.trim();
				navigate({ to: "/search", search: { q: q || undefined, page: 1 } });
			}}
		>
			<input
				type="search"
				name="q"
				value={value}
				onChange={(event) => setValue(event.target.value)}
				placeholder="レシピを検索（例：スプレッドシート 行削除）"
				aria-label="レシピを検索"
				className="w-full max-w-md rounded border px-3 py-2 text-sm"
			/>
			<button
				type="submit"
				className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
			>
				検索
			</button>
		</form>
	);
}
