// 検索クエリ文字列の正規化と、SQL の LIKE パターンへの変換。
// DB を必要としない純粋なロジックとしてここに切り出し、ユニットテストの
// 対象にする（issue #17）。

/** これ未満の長さのクエリは検索を実行しない（トライグラム索引が効かないため）。 */
export const SEARCH_MIN_LENGTH = 2;
/** 極端に長いクエリで DB を無駄に走らせないための上限。 */
export const SEARCH_MAX_LENGTH = 100;

/**
 * 入力欄の値を検索に使う形へ整える。
 * - 前後の空白を除去し、全角スペースを含む連続空白は半角1つにまとめる
 * - 長すぎるクエリは切り詰める
 * - 検索を実行すべきでない値（空・短すぎる）は undefined を返す
 */
export function normalizeSearchQuery(raw: unknown): string | undefined {
	if (typeof raw !== "string") return undefined;

	const normalized = raw.replace(/[\s　]+/g, " ").trim();
	if (normalized.length < SEARCH_MIN_LENGTH) return undefined;

	return normalized.slice(0, SEARCH_MAX_LENGTH);
}

/**
 * ILIKE の部分一致パターンへ変換する。ワイルドカード（% _）とエスケープ文字
 * （\）はリテラルとして扱いたいため、エスケープしてから前後に % を付ける。
 */
export function toLikePattern(query: string): string {
	const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
	return `%${escaped}%`;
}
