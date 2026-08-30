import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "../lib/auth/auth-client";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const { data: session, isPending } = authClient.useSession();

	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold">GAS Recipe Hub</h1>
			<p className="mt-4 text-lg">
				GAS の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース。
			</p>

			{/* Phase 1b（issue #12・#13）の動作確認用。ログイン UI 本体は Phase 1c で整備する。 */}
			<div className="mt-6">
				{isPending ? null : session ? (
					<div className="flex items-center gap-4">
						<p>
							{session.user.name} としてログイン中（role:{" "}
							{session.user.role ?? "user"}）
						</p>
						{session.user.role === "admin" && (
							<Link to="/admin" className="underline">
								管理ダッシュボード
							</Link>
						)}
						<button type="button" onClick={() => authClient.signOut()}>
							ログアウト
						</button>
					</div>
				) : (
					<button
						type="button"
						onClick={() =>
							authClient.signIn.social({ provider: "google", callbackURL: "/" })
						}
					>
						Google でログイン
					</button>
				)}
			</div>
		</div>
	);
}
