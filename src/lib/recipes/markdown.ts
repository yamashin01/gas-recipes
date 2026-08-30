import { Marked } from "marked";
import { highlightCode } from "./highlight";
import { isSnippetLanguage } from "./snippet-language";

// レシピ本文（body_md）は認証済みの管理者のみが書き込める
// （docs/proposal.md §2.1・§7）ため、投稿内容は信頼できる前提とし、
// 追加の HTML サニタイズは行わない（CLAUDE.md: 起こり得ないシナリオへの
// 検証は追加しない）。フェンスコードブロックは #16 と同じ highlight.js で
// ハイライトする。
const marked = new Marked({
	renderer: {
		code({ text, lang }) {
			const language = lang && isSnippetLanguage(lang) ? lang : "plaintext";
			return `<pre class="overflow-x-auto rounded bg-[#0d1117] p-3 text-xs"><code class="hljs language-${language}">${highlightCode(text, language)}</code></pre>`;
		},
	},
});

export function renderMarkdown(bodyMd: string): string {
	return marked.parse(bodyMd, { async: false });
}
