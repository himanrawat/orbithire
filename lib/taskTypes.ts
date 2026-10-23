/** Task queue types shared by server code and client components (no server imports here). */

export const TASK_TYPES = [
	"fetch_jobs",
	"fetch_watchlist",
	"rank_jobs",
	"render_pdf",
	"thumbnail",
	"digest",
	"generate_daily_plan",
	"billing_reminder",
	"push_reminders",
	"noop",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ["queued", "running", "done", "failed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface TaskRow {
	id: string;
	type: TaskType;
	payload: Record<string, unknown>;
	status: TaskStatus;
	priority: number;
	attempts: number;
	max_attempts: number;
	run_after: string;
	locked_at: string | null;
	locked_by: string | null;
	last_error: string | null;
	result: unknown;
	user_id: string | null;
	created_at: string;
	updated_at: string;
}

export function isTaskType(value: unknown): value is TaskType {
	return typeof value === "string" && (TASK_TYPES as readonly string[]).includes(value);
}
