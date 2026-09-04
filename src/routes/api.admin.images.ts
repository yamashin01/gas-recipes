import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

// レシピ本文（Markdown）に埋め込む画像のアップロード（issue #20）。
// createServerFn の RPC 形式は multipart/form-data を素直に扱えないため、
// api.auth.$.ts / api.health.ts と同じ server route の形で用意する。

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
};

export const Route = createFileRoute("/api/admin/images")({
	server: {
		handlers: {
			POST: async ({ request, context }) => {
				// server function ではないため、admin-recipes.ts 等と同じく
				// context.auth から直接セッションを検証する（requireAdminContext と同じ方針）。
				const session = await context.auth.api.getSession({
					headers: request.headers,
				});
				if (!session || session.user.role !== "admin") {
					return json({ error: "管理者権限が必要です" }, { status: 401 });
				}

				const formData = await request.formData();
				const file = formData.get("file");
				if (!(file instanceof File)) {
					return json(
						{ error: "画像ファイルを選択してください" },
						{ status: 400 },
					);
				}

				const extension = ALLOWED_IMAGE_TYPES[file.type];
				if (!extension) {
					return json(
						{ error: "対応していない画像形式です（png・jpeg・gif・webp）" },
						{ status: 400 },
					);
				}
				if (file.size > MAX_IMAGE_SIZE) {
					return json(
						{ error: "画像サイズは5MB以下にしてください" },
						{ status: 400 },
					);
				}

				const key = `${crypto.randomUUID()}.${extension}`;
				await env.RECIPE_IMAGES.put(key, await file.arrayBuffer(), {
					httpMetadata: { contentType: file.type },
				});

				return json({ url: `/images/${key}` });
			},
		},
	},
});
