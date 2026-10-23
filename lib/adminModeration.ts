// Read-side helpers for the admin moderation queue. The `content_reports` table belongs
// to Community and may not exist yet, so rows are read loosely and narrowed here.

export type ModerationReport = {
	id: string;
	reason: string;
	status: string;
	targetType: string | null;
	details: string | null;
	createdAt: string | null;
};

type QueryError = { code?: string; message?: string } | null | undefined;

// Postgres "undefined_table" and PostgREST "relation not in schema cache".
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

export function isMissingTableError(error: QueryError) {
	return !!error?.code && MISSING_TABLE_CODES.has(error.code);
}

function text(value: unknown, max = 500): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed.slice(0, max) : null;
}

function firstText(row: Record<string, unknown>, keys: readonly string[]) {
	for (const key of keys) {
		const value = text(row[key]);
		if (value) return value;
	}
	return null;
}

export function normalizeReport(row: Record<string, unknown>): ModerationReport | null {
	const id = text(row.id, 64);
	if (!id) return null;
	return {
		id,
		reason: firstText(row, ["reason", "category", "type"]) ?? "Unspecified",
		status: text(row.status, 40) ?? "open",
		targetType: firstText(row, ["target_type", "content_type", "subject_type"]),
		details: firstText(row, ["details", "note", "description", "message"]),
		createdAt: text(row.created_at, 64),
	};
}

export function normalizeReports(rows: unknown) {
	if (!Array.isArray(rows)) return [];
	return rows
		.filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
		.map(normalizeReport)
		.filter((report): report is ModerationReport => report !== null);
}
