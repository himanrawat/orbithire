import "server-only";

// Server helpers for focus and schedule: the next focus block (Today's "Coming up"), the
// weekly focus total, and the database calls the API routes share.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabaseServer";
import type { FocusSessionInput, ScheduleBlock } from "./schemas";
import { SESSION_MINUTES_COLUMNS, totalSessionMinutes, type SessionMinutesRow } from "./totals";

export const BLOCK_COLUMNS = "id, kind, title, starts_at, ends_at, google_event_id";

export async function requireUser() {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user ? { supabase, userId: user.id } : null;
}

/**
 * The next focus block that hasn't ended yet (one in progress counts), or null.
 * Pass a client to reuse one; defaults to the signed-in user's client (RLS applies).
 */
export async function getNextFocusBlock(
	userId: string,
	supabase: SupabaseClient = createServerSupabase(),
	now: Date = new Date()
): Promise<ScheduleBlock | null> {
	const { data, error } = await supabase
		.from("schedule_blocks")
		.select(BLOCK_COLUMNS)
		.eq("user_id", userId)
		.eq("kind", "focus")
		.gt("ends_at", now.toISOString())
		.order("starts_at", { ascending: true })
		.limit(1)
		.maybeSingle();
	if (error || !data) return null;
	return data as ScheduleBlock;
}

/** Monday 00:00 of the week containing `now`, in UTC (the server has no user time zone). */
export function utcWeekStart(now: Date) {
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
	return start;
}

export type WeeklyFocusSummary = Readonly<{
	minutes: number;
	sessions: number;
	completedSessions: number;
	/** from profiles.weekly_focus_hours; null when the user hasn't set a goal */
	goalMinutes: number | null;
	weekStart: string;
}>;

/**
 * Focus time since `weekStart` against the user's weekly goal (no streaks). Callers that
 * know the user's time zone should pass their local Monday midnight; the default is UTC.
 */
export async function getWeeklyFocusSummary(
	userId: string,
	options: Readonly<{ supabase?: SupabaseClient; weekStart?: Date }> = {}
): Promise<WeeklyFocusSummary> {
	const supabase = options.supabase ?? createServerSupabase();
	const weekStart = options.weekStart ?? utcWeekStart(new Date());
	const [sessions, profile] = await Promise.all([
		supabase
			.from("focus_sessions")
			.select(SESSION_MINUTES_COLUMNS)
			.eq("user_id", userId)
			.gte("started_at", weekStart.toISOString())
			.limit(1000),
		supabase.from("profiles").select("weekly_focus_hours").eq("id", userId).maybeSingle(),
	]);
	const rows = (sessions.data ?? []) as SessionMinutesRow[];
	const hours = profile.data?.weekly_focus_hours as number | null | undefined;
	return {
		minutes: totalSessionMinutes(rows),
		sessions: rows.length,
		completedSessions: rows.filter((row) => row.completed).length,
		goalMinutes: typeof hours === "number" && hours > 0 ? hours * 60 : null,
		weekStart: weekStart.toISOString(),
	};
}

export function toSessionRows(userId: string, sessions: readonly FocusSessionInput[]) {
	return sessions.map((s) => ({
		user_id: userId,
		client_id: s.client_id,
		task_label: s.task_label,
		task_ref: s.task_ref ?? null,
		planned_minutes: s.planned_minutes,
		focused_seconds: s.focused_seconds ?? null,
		started_at: s.started_at,
		ended_at: s.ended_at,
		completed: s.completed,
	}));
}

/** Batch insert; rows whose client_id already exists are skipped, so retries are safe. */
export async function insertFocusSessions(supabase: SupabaseClient, userId: string, sessions: readonly FocusSessionInput[]) {
	if (sessions.length === 0) return;
	const { error } = await supabase
		.from("focus_sessions")
		.upsert(toSessionRows(userId, sessions), { onConflict: "client_id", ignoreDuplicates: true });
	if (error) throw new Error(error.message);
}
