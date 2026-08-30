// BetterAuth の `secondaryStorage` を Workers KV で実装する。
// Neon Free プランはアイドル5分でコールドスタートするため、リクエストごとの
// セッション検証を KV でキャッシュすることが必須要件（docs/proposal.md §7.1）。

// better-auth はこの型を単一のエクスポートパスから公開していないため、
// betterAuth() に渡す際に構造的に一致する最小限の型をここで定義する。
export interface SecondaryStorage {
	get: (key: string) => Promise<string | null>;
	getAndDelete: (key: string) => Promise<string | null>;
	increment: (key: string, ttl: number) => Promise<number>;
	set: (key: string, value: string, ttl?: number) => Promise<void>;
	delete: (key: string) => Promise<void>;
}

// Cloudflare KV の expirationTtl は 60 秒未満を指定できない。
const MIN_KV_TTL_SECONDS = 60;

export function createKvSecondaryStorage(kv: KVNamespace): SecondaryStorage {
	return {
		async get(key) {
			return kv.get(key, { type: "text" });
		},
		async getAndDelete(key) {
			const value = await kv.get(key, { type: "text" });
			if (value !== null) {
				await kv.delete(key);
			}
			return value;
		},
		// SecondaryStorage インターフェースを満たすために実装しているが、
		// get→put の非アトミックな実装のため同時リクエストでカウントを
		// 取りこぼしうる（Workers KV に read-modify-write を1操作で行う手段が
		// 無いため）。better-auth のレート制限は auth.ts で storage: "database"
		// を指定しており、このメソッドは通常経路では呼ばれない。
		async increment(key, ttl) {
			const current = await kv.get(key, { type: "text" });
			const next = (current ? Number.parseInt(current, 10) : 0) + 1;
			await kv.put(key, String(next), {
				expirationTtl: Math.max(ttl, MIN_KV_TTL_SECONDS),
			});
			return next;
		},
		async set(key, value, ttl) {
			await kv.put(
				key,
				value,
				ttl ? { expirationTtl: Math.max(ttl, MIN_KV_TTL_SECONDS) } : undefined,
			);
		},
		async delete(key) {
			await kv.delete(key);
		},
	};
}
