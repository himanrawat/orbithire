// The focus timer as plain data. Remaining time is computed from timestamps, never from a
// running interval, so the timer survives reloads, sleep and going offline.

export const FOCUS_DURATIONS = [25, 50, 90] as const;
export type FocusDuration = (typeof FOCUS_DURATIONS)[number];

export const MAX_TASK_LABEL = 200;
export const MAX_TASK_REF = 200;
/** Sessions stopped before this much focused time are not recorded. */
export const MIN_RECORDED_SECONDS = 60;

export type FocusTimerState = Readonly<{
	status: "running" | "paused";
	clientId: string;
	taskLabel: string;
	taskRef: string | null;
	plannedMinutes: FocusDuration;
	/** ISO time the session first started */
	startedAt: string;
	/** epoch ms the current running segment began; null while paused */
	segmentStartedAt: number | null;
	/** focused ms from segments that already ended */
	elapsedMs: number;
}>;

/** A finished session, in the shape POST /api/focus/sessions takes. */
export type FocusSessionRecord = Readonly<{
	client_id: string;
	task_label: string;
	task_ref: string | null;
	planned_minutes: FocusDuration;
	focused_seconds: number;
	started_at: string;
	ended_at: string;
	completed: boolean;
}>;

export function isFocusDuration(value: unknown): value is FocusDuration {
	return typeof value === "number" && (FOCUS_DURATIONS as readonly number[]).includes(value);
}

export function plannedMs(state: Pick<FocusTimerState, "plannedMinutes">) {
	return state.plannedMinutes * 60_000;
}

export function elapsedMs(state: FocusTimerState, now: number) {
	const running = state.segmentStartedAt === null ? 0 : Math.max(0, now - state.segmentStartedAt);
	return Math.min(plannedMs(state), state.elapsedMs + running);
}

export function remainingMs(state: FocusTimerState, now: number) {
	return Math.max(0, plannedMs(state) - elapsedMs(state, now));
}

export function isFinished(state: FocusTimerState, now: number) {
	return remainingMs(state, now) <= 0;
}

export function startTimer(
	input: Readonly<{ taskLabel: string; taskRef?: string | null; plannedMinutes: FocusDuration; clientId: string }>,
	now: number
): FocusTimerState {
	return {
		status: "running",
		clientId: input.clientId,
		taskLabel: input.taskLabel.trim().slice(0, MAX_TASK_LABEL) || "Focus",
		taskRef: input.taskRef?.trim().slice(0, MAX_TASK_REF) || null,
		plannedMinutes: input.plannedMinutes,
		startedAt: new Date(now).toISOString(),
		segmentStartedAt: now,
		elapsedMs: 0,
	};
}

export function pauseTimer(state: FocusTimerState, now: number): FocusTimerState {
	if (state.status !== "running") return state;
	return { ...state, status: "paused", segmentStartedAt: null, elapsedMs: elapsedMs(state, now) };
}

export function resumeTimer(state: FocusTimerState, now: number): FocusTimerState {
	if (state.status !== "paused") return state;
	return { ...state, status: "running", segmentStartedAt: now };
}

/**
 * Ends the session. Returns the record to queue for sync, or null when too little time was
 * focused to count.
 */
export function finishTimer(state: FocusTimerState, now: number): FocusSessionRecord | null {
	const focused = Math.round(elapsedMs(state, now) / 1000);
	const completed = isFinished(state, now);
	if (!completed && focused < MIN_RECORDED_SECONDS) return null;
	return {
		client_id: state.clientId,
		task_label: state.taskLabel,
		task_ref: state.taskRef,
		planned_minutes: state.plannedMinutes,
		focused_seconds: focused,
		started_at: state.startedAt,
		ended_at: new Date(completionTime(state, now)).toISOString(),
		completed,
	};
}

/** When a finished running timer hit zero, so a reload hours later records the real end. */
function completionTime(state: FocusTimerState, now: number) {
	if (state.segmentStartedAt === null || !isFinished(state, now)) return now;
	return state.segmentStartedAt + (plannedMs(state) - state.elapsedMs);
}

/** A v4 UUID for the offline sync key; falls back when randomUUID isn't available (http). */
export function newClientId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** "24:59" or "1:29:59" */
export function formatClock(ms: number) {
	const total = Math.ceil(ms / 1000);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
	const ss = String(seconds).padStart(2, "0");
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Validates a value read back from storage. */
export function parseTimerState(value: unknown): FocusTimerState | null {
	if (!value || typeof value !== "object") return null;
	const v = value as Record<string, unknown>;
	const statusOk = v.status === "running" || v.status === "paused";
	const segmentOk = v.segmentStartedAt === null || typeof v.segmentStartedAt === "number";
	const basicsOk =
		typeof v.clientId === "string" &&
		typeof v.taskLabel === "string" &&
		typeof v.startedAt === "string" &&
		typeof v.elapsedMs === "number";
	if (!statusOk || !segmentOk || !basicsOk || !isFocusDuration(v.plannedMinutes)) return null;
	return {
		status: v.status as FocusTimerState["status"],
		clientId: v.clientId as string,
		taskLabel: v.taskLabel as string,
		taskRef: typeof v.taskRef === "string" ? v.taskRef : null,
		plannedMinutes: v.plannedMinutes,
		startedAt: v.startedAt as string,
		segmentStartedAt: v.segmentStartedAt as number | null,
		elapsedMs: v.elapsedMs as number,
	};
}
