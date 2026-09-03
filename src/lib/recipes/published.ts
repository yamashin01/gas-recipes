import { and, eq } from "drizzle-orm";
import { recipes } from "../../db/schema";

// status = published だけでなく visibility = public も条件にする。
// members は Phase 3（シンラボ会員限定公開）で使う想定のため、
// 公開ページからは現時点でも将来的にも除外する（docs/proposal.md §3.3）。
//
// Workers ランタイム専用 API（cloudflare:workers）に依存しない、この条件
// だけの独立したモジュールに切り出している。sitemap.ts はこの条件だけを
// 必要とし、public-recipes.ts 経由で import すると閲覧数記録（issue #21）が
// 引き込む cloudflare:workers 依存まで一緒にバンドルされ、vitest（Node）で
// 解決できずテストが壊れるため（sitemap.test.ts 参照）。
export const PUBLISHED = and(
	eq(recipes.status, "published"),
	eq(recipes.visibility, "public"),
);
