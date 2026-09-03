import serverEntry from "@tanstack/react-start/server-entry";
import { aggregateDailyViewCounts } from "./lib/views/aggregate";

// Cron Triggers はデフォルトの `@tanstack/react-start/server-entry`
// （fetch ハンドラのみ）では扱えないため、ここでラップして scheduled を
// 追加する（wrangler.jsonc の main はこのファイルを指す。issue #21）。
//
// fetch は @tanstack/react-start の RequestHandler 型（Cloudflare 固有の
// ExportedHandlerFetchHandler とは異なる汎用シグネチャ）のまま素通しするため、
// オブジェクト全体を ExportedHandler<Env> に当てはめようとはしない
// （fetch 部分だけ型が合わずビルドが壊れるため）。
export default {
	fetch: serverEntry.fetch,
	async scheduled(
		_controller: ScheduledController,
		_env: Env,
		ctx: ExecutionContext,
	) {
		ctx.waitUntil(aggregateDailyViewCounts());
	},
};
