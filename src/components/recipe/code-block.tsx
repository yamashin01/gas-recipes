import "highlight.js/styles/github-dark.min.css";
import { useState } from "react";
import { highlightCode } from "../../lib/recipes/highlight";

export interface CodeBlockProps {
	filename: string;
	language: string;
	code: string;
}

// レシピ詳細（#14）・管理画面のプレビュー（#16）の両方から使う想定の
// 表示専用コンポーネント。ハイライトはレンダー中に同期実行するため、
// SSR でも初期 HTML にハイライト済みコードが含まれる。
export function CodeBlock({ filename, language, code }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);
	const highlighted = highlightCode(code, language);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			window.alert("コピーに失敗しました");
		}
	}

	return (
		<div className="overflow-hidden rounded border border-gray-700">
			<div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
				<span className="font-mono text-xs text-gray-300">{filename}</span>
				<button
					type="button"
					onClick={handleCopy}
					className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
				>
					{copied ? "コピーしました" : "コピー"}
				</button>
			</div>
			<pre className="overflow-x-auto bg-[#0d1117] p-3 text-xs">
				<code
					className={`hljs language-${language}`}
					// hljs が渡したコードをエスケープした上で生成する HTML であり、
					// ユーザー入力の HTML をそのまま埋め込むものではない
					// biome-ignore lint/security/noDangerouslySetInnerHtml: hljs の出力のみを描画する
					dangerouslySetInnerHTML={{ __html: highlighted }}
				/>
			</pre>
		</div>
	);
}
