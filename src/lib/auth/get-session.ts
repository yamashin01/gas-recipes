import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

// グローバルミドルウェア（src/start.ts）が生成した auth インスタンスを
// context 経由で再利用する。ここで createAuth() を呼び直さない
// （docs/architecture.md §3-1）。SSR・クライアントサイド遷移のどちらの
// beforeLoad からも同じ挙動で呼び出せるよう、server function として実装する。
export const getAuthSession = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		return context.auth.api.getSession({ headers: getRequest().headers });
	},
);
