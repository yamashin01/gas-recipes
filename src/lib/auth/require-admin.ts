import { redirect } from "@tanstack/react-router";
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
