import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PUBLIC_CACHE_CONTROL } from "../lib/cache/edge-cache-policy";
import { getPublishedCollectionBySlug } from "../lib/collections/public-collections";
import { seo } from "../lib/seo/site";

export const Route = createFileRoute("/collections/$slug")({
	loader: async ({ params }) => {
		const collection = await getPublishedCollectionBySlug({
			data: params.slug,
		});
		if (!collection) {
			throw notFound();
		}
		return collection;
	},
	headers: () => ({ "cache-control": PUBLIC_CACHE_CONTROL }),
	head: ({ loaderData, params }) =>
		loaderData
			? seo({
					title: `${loaderData.title} | GAS Recipe Hub`,
					description: loaderData.description || loaderData.title,
					path: `/collections/${encodeURIComponent(params.slug)}`,
				})
			: {},
	component: CollectionPage,
});

function CollectionPage() {
	const collection = Route.useLoaderData();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold">{collection.title}</h1>
			{collection.description && (
				<p className="mt-2 text-sm text-gray-600">{collection.description}</p>
			)}

			<ol className="mt-6 flex flex-col gap-4">
				{collection.items.length === 0 ? (
					<p className="text-sm text-gray-500">
						このシリーズにはまだレシピがありません。
					</p>
				) : (
					collection.items.map((item, index) => (
						<li key={item.slug} className="rounded border p-4">
							<span className="text-xs text-gray-400">第{index + 1}回</span>
							<h2 className="text-lg font-bold">
								<Link
									to="/recipes/$slug"
									params={{ slug: item.slug }}
									search={{ collection: collection.slug }}
									className="hover:underline"
								>
									{item.title}
								</Link>
							</h2>
							{item.summary && (
								<p className="mt-1 text-sm text-gray-600">{item.summary}</p>
							)}
						</li>
					))
				)}
			</ol>
		</div>
	);
}
