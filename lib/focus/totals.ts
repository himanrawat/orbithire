// How much a stored focus session counts toward the weekly total. Pure, so the Today page
// and the focus page agree on the number.

export type SessionMinutesRow = Readonly<{
	focused_seconds: number | null;
	planned_minutes: number;
	completed: boolean;
}>;

/** The columns `sessionMinutes` needs, for `.select(...)`. */
export const SESSION_MINUTES_COLUMNS = "focused_seconds, planned_minutes, completed";

/** Minutes a session counts for: time actually focused, or the plan for completed rows without it. */
export function sessionMinutes(row: SessionMinutesRow) {
	if (typeof row.focused_seconds === "number") return Math.round(row.focused_seconds / 60);
	return row.completed ? row.planned_minutes : 0;
}

export function totalSessionMinutes(rows: readonly SessionMinutesRow[]) {
	return rows.reduce((total, row) => total + sessionMinutes(row), 0);
}
