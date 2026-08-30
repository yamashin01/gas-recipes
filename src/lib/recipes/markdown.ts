import { Marked } from "marked";
import { highlightCode } from "./highlight";
import { isSnippetLanguage } from "./snippet-language";

// レシピ本文（body_md）は認証済みの管理者のみが書き込めるが、レンダリング先は
// 全訪問者に配信される公開ページのため、アカウント侵害や誤操作の影響範囲が
// 大きい（レビュー指摘）。generic な HTML サニタイザ（DOMPurify 等）は
// Workers 上で DOM 実装に依存するため導入せず、marked のレンダラーを
// 上書きしてリスクの高い経路（生 HTML の埋め込み、javascript: 等の URL
// スキーム）だけを塞ぐ。
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

const SAFE_URL_PATTERN = /^(?:https?:|mailto:|\/|#)/i;

function sanitizeUrl(href: string): string {
	return SAFE_URL_PATTERN.test(href) ? href : "#";
}

const marked = new Marked({
	renderer: {
		code({ text, lang }) {
			const language = lang && isSnippetLanguage(lang) ? lang : "plaintext";
			return `<pre class="overflow-x-auto rounded bg-[#0d1117] p-3 text-xs"><code class="hljs language-${language}">${highlightCode(text, language)}</code></pre>`;
		},
		// Markdown 内に直接書かれた生 HTML（<script> 等）はエスケープしてテキスト
		// として表示し、実行されないようにする
		html({ text }) {
			return escapeHtml(text);
		},
		link({ href, title, tokens }) {
			const safeHref = sanitizeUrl(href);
			const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
			return `<a href="${safeHref}"${titleAttr} rel="noopener noreferrer">${this.parser.parseInline(tokens)}</a>`;
		},
		image({ href, title, text }) {
			const safeHref = sanitizeUrl(href);
			const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
			return `<img src="${safeHref}" alt="${escapeHtml(text)}"${titleAttr}>`;
		},
	},
});

export function renderMarkdown(bodyMd: string): string {
	return marked.parse(bodyMd, { async: false });
}
