import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
	it("escapes raw HTML embedded in the markdown source", () => {
		const html = renderMarkdown('本文<script>alert("xss")</script>');
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
	});

	it("rejects javascript: URLs in links", () => {
		const html = renderMarkdown("[click me](javascript:alert(1))");
		expect(html).not.toContain('href="javascript:');
		expect(html).toContain('href="#"');
	});

	it("keeps ordinary https links intact", () => {
		const html = renderMarkdown("[GAS Recipe Hub](https://example.com)");
		expect(html).toContain('href="https://example.com"');
	});

	it("renders fenced code blocks with syntax highlighting", () => {
		const html = renderMarkdown("```javascript\nconst x = 1;\n```");
		expect(html).toContain("hljs");
		expect(html).toContain("language-javascript");
	});
});
