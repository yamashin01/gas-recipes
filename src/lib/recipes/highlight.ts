import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import plaintext from "highlight.js/lib/languages/plaintext";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("plaintext", plaintext);

// lib/core は言語定義を一切含まないため、未登録の言語（自由入力を想定していない
// が念のため）はプレーンテキストとして表示する。
export function highlightCode(code: string, language: string): string {
	const target = hljs.getLanguage(language) ? language : "plaintext";
	return hljs.highlight(code, { language: target }).value;
}
