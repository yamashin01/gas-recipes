import { createFileRoute, Link } from "@tanstack/react-router";
import { RecipeCard } from "../components/recipe/recipe-card";
import { authClient } from "../lib/auth/auth-client";
import { getHomeData } from "../lib/recipes/public-recipes";

export const Route = createFileRoute("/")({
	loader: () => getHomeData(),
	head: () => ({
		meta: [
			{ title: "GAS Recipe Hub" },
			{
				name: "description",
				content:
					"GAS の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース。",
			},
		],
	}),
	component: Home,
});

function Home() {
	const { data: session, isPending } = authClient.useSession();
	const { latestRecipes, popularTags } = Route.useLoaderData();

	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold">GAS Recipe Hub</h1>
			<p className="mt-4 text-lg">
				GAS の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース。
			</p>

			{/* 管理者は /admin から書き込み操作を行う（issue #12・#13） */}
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

			<section className="mt-10">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-bold">最新のレシピ</h2>
					<Link
						to="/recipes"
						search={{ page: 1 }}
						className="text-sm underline"
					>
						すべて見る
					</Link>
				</div>
				<div className="mt-4 flex flex-col gap-4">
					{latestRecipes.length === 0 ? (
						<p className="text-sm text-gray-500">
							まだ公開されているレシピはありません。
						</p>
					) : (
						latestRecipes.map((recipe) => (
							<RecipeCard key={recipe.id} recipe={recipe} />
						))
					)}
				</div>
			</section>

			{popularTags.length > 0 && (
				<section className="mt-10">
					<h2 className="text-xl font-bold">人気のタグ</h2>
					<div className="mt-4 flex flex-wrap gap-2">
						{popularTags.map((tag) => (
							<Link
								key={tag.id}
								to="/tags/$slug"
								params={{ slug: tag.slug }}
								search={{ page: 1 }}
								className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
							>
								{tag.name}（{tag.recipeCount}）
							</Link>
						))}
					</div>
				</section>
			)}
		</div>
	);
}
