import { describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("createDb", () => {
	it("creates a new Drizzle instance per call rather than a module-level singleton", () => {
		// docs/architecture.md §3-1: Workers では DB インスタンスをリクエストごとに1つ生成する
		const dummyUrl = "postgres://user:pass@localhost:5432/db";
		expect(createDb(dummyUrl)).not.toBe(createDb(dummyUrl));
	});
});
