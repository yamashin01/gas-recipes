import { describe, expect, it, vi } from "vitest";
import { createKvSecondaryStorage } from "./kv-secondary-storage";

// Cloudflare KV の最小限のインメモリ実装（テスト用）
function createFakeKv() {
	const store = new Map<string, string>();
	return {
		store,
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		put: vi.fn(
			async (
				key: string,
				value: string,
				_options?: { expirationTtl?: number },
			) => {
				store.set(key, value);
			},
		),
		delete: vi.fn(async (key: string) => {
			store.delete(key);
		}),
	} as unknown as KVNamespace & {
		store: Map<string, string>;
		put: ReturnType<typeof vi.fn>;
	};
}

describe("createKvSecondaryStorage", () => {
	it("set() writes through to KV and get() reads it back", async () => {
		const kv = createFakeKv();
		const storage = createKvSecondaryStorage(kv);

		await storage.set("session:abc", "value", 3600);

		expect(await storage.get("session:abc")).toBe("value");
	});

	it("get() returns null for a missing key without hitting the fallback", async () => {
		const kv = createFakeKv();
		const storage = createKvSecondaryStorage(kv);

		expect(await storage.get("missing")).toBeNull();
	});

	it("getAndDelete() returns the value and removes it from KV", async () => {
		const kv = createFakeKv();
		const storage = createKvSecondaryStorage(kv);
		await storage.set("token:1", "value");

		const value = await storage.getAndDelete("token:1");

		expect(value).toBe("value");
		expect(await storage.get("token:1")).toBeNull();
	});

	it("delete() removes the key", async () => {
		const kv = createFakeKv();
		const storage = createKvSecondaryStorage(kv);
		await storage.set("session:abc", "value");

		await storage.delete("session:abc");

		expect(await storage.get("session:abc")).toBeNull();
	});

	it("increment() starts at 1 and increments on repeated calls", async () => {
		const kv = createFakeKv();
		const storage = createKvSecondaryStorage(kv);

		expect(await storage.increment("count", 60)).toBe(1);
		expect(await storage.increment("count", 60)).toBe(2);
	});

	it("clamps a ttl below Cloudflare KV's 60 second minimum", async () => {
		const kv = createFakeKv();
		const storage = createKvSecondaryStorage(kv);

		await storage.set("session:abc", "value", 10);

		expect(kv.put).toHaveBeenCalledWith(
			"session:abc",
			"value",
			expect.objectContaining({ expirationTtl: 60 }),
		);
	});

	it("does not pass an expiration when no ttl is given", async () => {
		const kv = createFakeKv();
		const storage = createKvSecondaryStorage(kv);

		await storage.set("session:abc", "value");

		expect(kv.put).toHaveBeenCalledWith("session:abc", "value", undefined);
	});
});
