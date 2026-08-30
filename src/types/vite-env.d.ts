/// <reference types="vite/client" />

// クライアント・サーバー双方のバンドルに埋め込まれるビルド時の環境変数。
// canonical / OGP / sitemap の絶対 URL 生成に使う（issue #18）。
interface ImportMetaEnv {
	/** 公開サイトの origin（例：https://gas-recipes.example.com）。未設定でも動く */
	readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
