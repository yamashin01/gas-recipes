import { createFileRoute } from "@tanstack/react-router";

// BetterAuth の /api/auth/* ハンドラ（docs/proposal.md §6）。
// グローバルミドルウェア（src/start.ts）が生成した auth インスタンスを
// context 経由で再利用し、ここでは新たに生成しない
// （docs/architecture.md §3-1）。
export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request, context }) => context.auth.handler(request),
			POST: ({ request, context }) => context.auth.handler(request),
		},
	},
});
