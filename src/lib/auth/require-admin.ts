import { redirect } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import type { AppRequestContext } from "../../start";
import { getAuthSession } from "./get-session";

// admin ロールを持つセッションを要求する beforeLoad ガード。
// 未認証・非 admin はいずれもトップページへリダイレクトする
// （docs/proposal.md §7、issue #13）。
export async function requireAdminSession() {
	const session = await getAuthSession();

	if (!session || session.user.role !== "admin") {
		throw redirect({ to: "/" });
	}

	return session;
}

// server function 内から admin ロールを検証する版。/admin 配下のルートは
// beforeLoad で requireAdminSession によりガードされるが、レシピの作成・
// 更新・削除を行う server function は直接呼び出せてしまうため、書き込み系の
// 処理では個別に admin ロールを検証する（CLAUDE.md、issue #15）。
// context.auth は既にリクエストミドルウェアで生成済みのため、
// getAuthSession（server function 経由の別リクエスト）を使わずここで直接検証する。
export async function requireAdminContext(context: AppRequestContext) {
	const session = await context.auth.api.getSession({
		headers: getRequest().headers,
	});

	if (!session || session.user.role !== "admin") {
		throw new Error("管理者権限が必要です");
	}

	return session;
}
