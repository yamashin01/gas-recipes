import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// ブラウザから /api/auth/* を呼び出すクライアント。baseURL は同一オリジンで
// 良いため未指定（`src/routes/api.auth.$.ts` が受ける）。
export const authClient = createAuthClient({
	plugins: [adminClient()],
});
