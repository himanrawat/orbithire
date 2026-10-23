import { z } from "zod";
import { FOCUS_DURATIONS, MAX_TASK_LABEL, MAX_TASK_REF } from "./timer";

export const BLOCK_KINDS = ["learn", "prep", "apply", "focus", "other"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_KIND_LABELS: Readonly<Record<BlockKind, string>> = {
	learn: "Learn",
	prep: "Interview prep",
	apply: "Apply",
	focus: "Focus",
	other: "Other",
};

export const MAX_SESSIONS_PER_SYNC = 50;
const MAX_BLOCK_MS = 24 * 60 * 60 * 1000;
/** Clock skew we tolerate between a phone and the server. */
const FUTURE_SLACK_MS = 10 * 60 * 1000;

const isoDate = z.string().datetime({ offset: true });

export const focusSessionSchema = z
	.object({
		client_id: z.string().uuid(),
		task_label: z.string().trim().min(1).max(MAX_TASK_LABEL),
		task_ref: z.string().trim().max(MAX_TASK_REF).nullable().optional(),
		planned_minutes: z.union([z.literal(FOCUS_DURATIONS[0]), z.literal(FOCUS_DURATIONS[1]), z.literal(FOCUS_DURATIONS[2])]),
		focused_seconds: z.number().int().min(0).max(90 * 60).optional(),
		started_at: isoDate,
		ended_at: isoDate,
		completed: z.boolean(),
	})
	.strict()
	.refine((s) => Date.parse(s.ended_at) >= Date.parse(s.started_at), {
		message: "ended_at must be after started_at",
		path: ["ended_at"],
	})
	.refine((s) => Date.parse(s.ended_at) <= Date.now() + FUTURE_SLACK_MS, {
		message: "ended_at is in the future",
		path: ["ended_at"],
	});

/** Items are validated one by one, so one bad session can't block the rest of the outbox. */
export const focusSessionBatchSchema = z
	.object({ sessions: z.array(z.unknown()).min(1).max(MAX_SESSIONS_PER_SYNC) })
	.strict();

export type FocusSessionInput = z.infer<typeof focusSessionSchema>;

function validRange(value: { starts_at?: string; ends_at?: string }) {
	if (!value.starts_at || !value.ends_at) return true;
	const length = Date.parse(value.ends_at) - Date.parse(value.starts_at);
	return length > 0 && length <= MAX_BLOCK_MS;
}

const rangeIssue = { message: "A block must end after it starts and last at most 24 hours", path: ["ends_at"] };

export const createBlockSchema = z
	.object({
		kind: z.enum(BLOCK_KINDS),
		title: z.string().trim().min(1).max(200),
		starts_at: isoDate,
		ends_at: isoDate,
	})
	.strict()
	.refine(validRange, rangeIssue);

export const updateBlockSchema = z
	.object({
		kind: z.enum(BLOCK_KINDS).optional(),
		title: z.string().trim().min(1).max(200).optional(),
		starts_at: isoDate.optional(),
		ends_at: isoDate.optional(),
	})
	.strict()
	.refine((v) => (v.starts_at === undefined) === (v.ends_at === undefined), {
		message: "Send starts_at and ends_at together",
		path: ["ends_at"],
	})
	.refine(validRange, rangeIssue);

export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;

export type ScheduleBlock = Readonly<{
	id: string;
	kind: BlockKind;
	title: string;
	starts_at: string;
	ends_at: string;
	google_event_id: string | null;
}>;

/** A read-only event from the user's own calendar, shown beside their blocks. */
export type ExternalEvent = Readonly<{
	id: string;
	title: string;
	starts_at: string;
	ends_at: string;
	all_day: boolean;
}>;

/** Parses ?start=&end= for range queries; caps the window at 6 weeks. */
export function parseRange(params: URLSearchParams): { start: string; end: string } | null {
	const start = params.get("start");
	const end = params.get("end");
	if (!start || !end) return null;
	const startMs = Date.parse(start);
	const endMs = Date.parse(end);
	if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
	if (endMs - startMs > 42 * 24 * 60 * 60 * 1000) return null;
	return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}
