import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold">GAS Recipe Hub</h1>
			<p className="mt-4 text-lg">
				GAS の実装パターンを「レシピ」単位で蓄積・公開するナレッジベース。
			</p>
		</div>
	);
}
