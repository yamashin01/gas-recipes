import { createFileRoute } from "@tanstack/react-router";

// レシピ CRUD 本体は Phase 1c（issue #15）で実装する。
// ここでは Phase 1b の完了条件（admin ロールガードの動作確認）用の
// 最小のダッシュボードを用意する。
export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">管理ダッシュボード</h1>
			<p className="mt-2 text-sm text-gray-500">
				レシピの作成・編集は Phase 1c で実装予定です。
			</p>
		</div>
	);
}
