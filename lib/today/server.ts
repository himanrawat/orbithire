/**
 * Server-only data loaders for the Today page. Every query uses the caller's
 * RLS-scoped client. Tables owned by other areas (focus_sessions, learning_entries) and onboarding columns may not exist yet: those reads fail soft.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	DEFAULT_TIME_ZONE,
	INTERVIEW_WINDOW_HOURS,
	STRONG_MATCH_SCORE,
	buildDailyPlan,
	carryOverDone,
	localDateKey,
	safeTimeZone,
	type FollowUpSignal,
	type InterviewSignal,
	type LessonSignal,
	type PlanItem,
	type TodaySignals,
} from "./nextStep";
import { getActiveLesson } from "@/lib/learn/server";
import { parseStoredItems } from "./schema";
import type { ComingUpItem, TodayMatch, TodayPlan, WeeklyFocus } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const FOLLOW_UP_LOOKAHEAD_HOURS = 48;

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function relatedName(value: unknown): string {
	const rel = Array.isArray(value) ? value[0] : value;
	if (rel && typeof rel === "object") return str((rel as Row).name) ?? "a company";
	return "a company";
}

export type ProfileBasics = { firstName: string | null; timeZone: string };

export async function loadProfileBasics(
	supabase: SupabaseClient,
	userId: string
): Promise<ProfileBasics> {
	const { data } = await supabase
		.from("profiles")
		.select("full_name, timezone")
		.eq("id", userId)
		.maybeSingle();
	const row = (data ?? {}) as Row;
	const fullName = str(row.full_name);
	return {
		firstName: fullName ? fullName.split(" ")[0] : null,
		timeZone: safeTimeZone(str(row.timezone) ?? DEFAULT_TIME_ZONE),
	};
}

async function loadInterviewSignals(
	supabase: SupabaseClient,
	userId: string,
	now: Date
): Promise<InterviewSignal[]> {
	const end = new Date(now.getTime() + INTERVIEW_WINDOW_HOURS * HOUR_MS);
	const { data } = await supabase
		.from("companies")
		.select("id, name, interview_at")
		.eq("user_id", userId)
		.gte("interview_at", now.toISOString())
		.lte("interview_at", end.toISOString())
		.order("interview_at", { ascending: true })
		.limit(5);
	return ((data ?? []) as Row[]).map((r) => ({
		companyId: String(r.id),
		companyName: str(r.name) ?? "a company",
		interviewAt: String(r.interview_at),
	}));
}

async function loadFollowUpSignals(
	supabase: SupabaseClient,
	userId: string,
	now: Date
): Promise<FollowUpSignal[]> {
	const horizon = new Date(now.getTime() + FOLLOW_UP_LOOKAHEAD_HOURS * HOUR_MS);
	const { data } = await supabase
		.from("follow_ups")
		.select("id, company_id, next_reminder_at, companies(name)")
		.eq("user_id", userId)
		.eq("status", "active")
		.not("next_reminder_at", "is", null)
		.lte("next_reminder_at", horizon.toISOString())
		.order("next_reminder_at", { ascending: true })
		.limit(5);
	return ((data ?? []) as Row[]).map((r) => ({
		id: String(r.id),
		companyId: String(r.company_id),
		companyName: relatedName(r.companies),
		dueAt: String(r.next_reminder_at),
	}));
}

/** Learn (area 3): the most recently started, unfinished lesson. Never throws. */
async function loadLessonSignal(
	supabase: SupabaseClient,
	userId: string
): Promise<LessonSignal | null> {
	const active = await getActiveLesson(userId, supabase);
	return active ? { id: active.lessonId, title: active.lessonTitle, href: active.href } : null;
}

async function countStrongMatches(supabase: SupabaseClient, userId: string): Promise<number> {
	const { count } = await supabase
		.from("job_matches")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.eq("status", "new")
		.gte("llm_score", STRONG_MATCH_SCORE)
		.or("prefilter_pass.is.null,prefilter_pass.eq.true");
	return count ?? 0;
}

export async function loadSignals(
	supabase: SupabaseClient,
	userId: string,
	now: Date,
	timeZone: string
): Promise<TodaySignals> {
	const [interviews, followUps, lesson, strongMatchCount] = await Promise.all([
		loadInterviewSignals(supabase, userId, now),
		loadFollowUpSignals(supabase, userId, now),
		loadLessonSignal(supabase, userId),
		countStrongMatches(supabase, userId),
	]);
	return { now, timeZone, interviews, followUps, lesson, strongMatchCount };
}

export async function loadTopMatches(
	supabase: SupabaseClient,
	userId: string
): Promise<TodayMatch[]> {
	const { data } = await supabase
		.from("job_inbox")
		.select("id, title, company, location, is_remote, llm_score")
		.eq("user_id", userId)
		.eq("status", "new")
		.eq("is_active", true)
		.or("prefilter_pass.is.null,prefilter_pass.eq.true")
		.order("llm_score", { ascending: false, nullsFirst: false })
		.order("similarity", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.limit(3);
	return ((data ?? []) as Row[]).map((r) => ({
		id: String(r.id),
		title: str(r.title) ?? "Untitled role",
		company: str(r.company),
		location: str(r.location),
		isRemote: r.is_remote === true,
		score: typeof r.llm_score === "number" ? r.llm_score : null,
	}));
}

async function nextInterview(
	supabase: SupabaseClient,
	userId: string,
	now: Date
): Promise<ComingUpItem | null> {
	const { data } = await supabase
		.from("companies")
		.select("id, name, interview_at")
		.eq("user_id", userId)
		.gte("interview_at", now.toISOString())
		.order("interview_at", { ascending: true })
		.limit(1)
		.maybeSingle();
	const row = data as Row | null;
	if (!row) return null;
	return {
		id: `interview:${String(row.id)}`,
		kind: "interview",
		title: `Interview with ${str(row.name) ?? "a company"}`,
		at: String(row.interview_at),
		href: `/companies/${String(row.id)}`,
	};
}

async function nextFollowUp(
	supabase: SupabaseClient,
	userId: string,
	now: Date
): Promise<ComingUpItem | null> {
	const { data } = await supabase
		.from("follow_ups")
		.select("id, company_id, next_reminder_at, companies(name)")
		.eq("user_id", userId)
		.eq("status", "active")
		.gte("next_reminder_at", now.toISOString())
		.order("next_reminder_at", { ascending: true })
		.limit(1)
		.maybeSingle();
	const row = data as Row | null;
	if (!row) return null;
	return {
		id: `follow_up:${String(row.id)}`,
		kind: "follow_up",
		title: `Follow up with ${relatedName(row.companies)}`,
		at: String(row.next_reminder_at),
		href: `/companies/${String(row.company_id)}`,
	};
}

/** Next interview and next follow-up, soonest first. Focus blocks join with area 5. */
export async function loadComingUp(
	supabase: SupabaseClient,
	userId: string,
	now: Date
): Promise<ComingUpItem[]> {
	const items = await Promise.all([
		nextInterview(supabase, userId, now),
		nextFollowUp(supabase, userId, now),
	]);
	return items
		.filter((i): i is ComingUpItem => i !== null)
		.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

async function loadFocusGoal(supabase: SupabaseClient, userId: string): Promise<number | null> {
	const { data, error } = await supabase
		.from("profiles")
		.select("weekly_focus_hours")
		.eq("id", userId)
		.maybeSingle();
	if (error || !data) return null;
	const hours = (data as Row).weekly_focus_hours;
	return typeof hours === "number" && hours > 0 ? hours : null;
}

async function loadFocusMinutes(
	supabase: SupabaseClient,
	userId: string,
	now: Date
): Promise<number> {
	const since = new Date(now.getTime() - 7 * 24 * HOUR_MS);
	const { data, error } = await supabase
		.from("focus_sessions")
		.select("duration_minutes")
		.eq("user_id", userId)
		.gte("started_at", since.toISOString())
		.limit(500);
	if (error || !data) return 0;
	return (data as Row[]).reduce((sum, r) => {
		const m = r.duration_minutes;
		return sum + (typeof m === "number" ? m : 0);
	}, 0);
}

/** Weekly focus total vs goal; null when there is neither a goal nor any logged time. */
export async function loadWeeklyFocus(
	supabase: SupabaseClient,
	userId: string,
	now: Date
): Promise<WeeklyFocus | null> {
	const [goalHours, minutes] = await Promise.all([
		loadFocusGoal(supabase, userId),
		loadFocusMinutes(supabase, userId, now),
	]);
	if (goalHours === null && minutes === 0) return null;
	return { goalHours, minutes };
}

/** True once the learning log table (area 3) exists. */
export async function hasLearningLog(supabase: SupabaseClient): Promise<boolean> {
	const { error } = await supabase
		.from("learning_entries")
		.select("id", { count: "exact", head: true })
		.limit(1);
	return !error;
}

export type StoredPlan = TodayPlan & { nextStepDismissed: boolean };

function toStoredPlan(row: Row): StoredPlan {
	return {
		date: String(row.date),
		items: parseStoredItems(row.items),
		generatedAt: String(row.generated_at),
		nextStepDismissed: row.next_step_dismissed_at !== null && row.next_step_dismissed_at !== undefined,
	};
}

const PLAN_COLUMNS = "date, items, generated_at, next_step_dismissed_at";

export async function loadPlan(
	supabase: SupabaseClient,
	userId: string,
	date: string
): Promise<StoredPlan | null> {
	const { data } = await supabase
		.from("daily_plans")
		.select(PLAN_COLUMNS)
		.eq("user_id", userId)
		.eq("date", date)
		.maybeSingle();
	return data ? toStoredPlan(data as Row) : null;
}

/** Creates today's plan from the rules unless the worker (or a race) already did. */
export async function ensurePlan(
	supabase: SupabaseClient,
	userId: string,
	signals: TodaySignals
): Promise<StoredPlan | null> {
	const date = localDateKey(signals.now, signals.timeZone);
	const existing = await loadPlan(supabase, userId, date);
	if (existing) return existing;
	const { error } = await supabase.from("daily_plans").upsert(
		{ user_id: userId, date, items: buildDailyPlan(signals), source: "on_demand" },
		{ onConflict: "user_id,date", ignoreDuplicates: true }
	);
	if (error) console.error("[today] could not create plan:", error);
	return loadPlan(supabase, userId, date);
}

/** Rebuilds today's plan from the rules, keeping check-offs for items that remain. */
export async function regeneratePlan(
	supabase: SupabaseClient,
	userId: string,
	signals: TodaySignals
): Promise<StoredPlan | null> {
	const date = localDateKey(signals.now, signals.timeZone);
	const previous = await loadPlan(supabase, userId, date);
	const items: PlanItem[] = carryOverDone(buildDailyPlan(signals), previous?.items ?? []);
	const { data, error } = await supabase
		.from("daily_plans")
		.upsert(
			{
				user_id: userId,
				date,
				items,
				source: "on_demand",
				generated_at: signals.now.toISOString(),
			},
			{ onConflict: "user_id,date" }
		)
		.select(PLAN_COLUMNS)
		.single();
	if (error || !data) {
		console.error("[today] could not regenerate plan:", error);
		return null;
	}
	return toStoredPlan(data as Row);
}
