/**
 * Today (PRD area 2): next-step rules and daily plan builder. Pure, no I/O.
 *
 * Mirrored in Python by worker/orbithire_worker/today/plan.py; keep both in sync.
 * First matching rule wins for the next step:
 *   1. an interview within 3 days       -> prep for it
 *   2. a follow-up due today (or late)  -> send the drafted follow-up
 *   3. a path lesson in progress        -> continue the lesson
 *   4. new matches scoring 80 or more   -> review them
 *   5. otherwise                        -> a focus block
 */

export const PLAN_ITEM_KINDS = [
	"interview_prep",
	"follow_up",
	"lesson",
	"review_matches",
	"focus_block",
	"job_inbox",
	"profile",
] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KINDS)[number];

export type PlanItem = {
	id: string;
	kind: PlanItemKind;
	title: string;
	reason: string;
	href: string;
	done: boolean;
};

export type InterviewSignal = Readonly<{
	companyId: string;
	companyName: string;
	interviewAt: string;
}>;

export type FollowUpSignal = Readonly<{
	id: string;
	companyId: string;
	companyName: string;
	dueAt: string;
}>;

export type LessonSignal = Readonly<{
	id: string;
	title: string;
	href: string;
}>;

export type TodaySignals = Readonly<{
	now: Date;
	/** IANA zone used to decide what "today" means. */
	timeZone: string;
	interviews: readonly InterviewSignal[];
	followUps: readonly FollowUpSignal[];
	lesson: LessonSignal | null;
	/** Count of new matches scoring at least STRONG_MATCH_SCORE. */
	strongMatchCount: number;
}>;

export const INTERVIEW_WINDOW_HOURS = 72;
export const STRONG_MATCH_SCORE = 80;
export const MIN_PLAN_ITEMS = 3;
export const MAX_PLAN_ITEMS = 5;
export const DEFAULT_TIME_ZONE = "America/New_York";

const HOUR_MS = 60 * 60 * 1000;

/** Returns `tz` when the runtime knows it, otherwise the default zone. */
export function safeTimeZone(tz: string | null | undefined): string {
	if (!tz) return DEFAULT_TIME_ZONE;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return tz;
	} catch {
		return DEFAULT_TIME_ZONE;
	}
}

/** YYYY-MM-DD of `date` in `timeZone`. */
export function localDateKey(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: safeTimeZone(timeZone),
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

function toTime(value: string): number {
	const t = new Date(value).getTime();
	return Number.isNaN(t) ? Number.NaN : t;
}

function sortByTime<T>(items: readonly T[], at: (item: T) => string): T[] {
	return [...items].sort((a, b) => toTime(at(a)) - toTime(at(b)));
}

/** Interviews from now until INTERVIEW_WINDOW_HOURS ahead, soonest first. */
export function upcomingInterviews(signals: TodaySignals): InterviewSignal[] {
	const now = signals.now.getTime();
	const end = now + INTERVIEW_WINDOW_HOURS * HOUR_MS;
	const within = signals.interviews.filter((i) => {
		const t = toTime(i.interviewAt);
		return t >= now && t <= end;
	});
	return sortByTime(within, (i) => i.interviewAt);
}

/** Follow-ups due on or before today's local date, oldest first. */
export function dueFollowUps(signals: TodaySignals): FollowUpSignal[] {
	const today = localDateKey(signals.now, signals.timeZone);
	const due = signals.followUps.filter((f) => {
		if (Number.isNaN(toTime(f.dueAt))) return false;
		return localDateKey(new Date(f.dueAt), signals.timeZone) <= today;
	});
	return sortByTime(due, (f) => f.dueAt);
}

function formatInterviewTime(iso: string, timeZone: string): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: safeTimeZone(timeZone),
		weekday: "short",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function plural(n: number, word: string): string {
	return `${n} ${word}${n === 1 ? "" : "es"}`;
}

export function interviewPrepItem(i: InterviewSignal, timeZone: string): PlanItem {
	return {
		id: `interview_prep:${i.companyId}`,
		kind: "interview_prep",
		title: `Prep for your ${i.companyName} interview`,
		reason: `Your interview is ${formatInterviewTime(i.interviewAt, timeZone)}. Practice one likely question.`,
		href: `/prep?company=${i.companyId}`,
		done: false,
	};
}

export function followUpItem(f: FollowUpSignal): PlanItem {
	return {
		id: `follow_up:${f.id}`,
		kind: "follow_up",
		title: `Send your follow-up to ${f.companyName}`,
		reason: "A follow-up is due today. Your draft is ready to review.",
		href: `/companies/${f.companyId}`,
		done: false,
	};
}

export function lessonItem(l: LessonSignal): PlanItem {
	return {
		id: `lesson:${l.id}`,
		kind: "lesson",
		title: `Continue "${l.title}"`,
		reason: "You're partway through this lesson. Pick up where you left off.",
		href: l.href,
		done: false,
	};
}

export function reviewMatchesItem(count: number): PlanItem {
	return {
		id: "review_matches",
		kind: "review_matches",
		title: `Review ${plural(count, "strong match")}`,
		reason: `New roles scored ${STRONG_MATCH_SCORE} or higher against your profile.`,
		href: "/jobs",
		done: false,
	};
}

export function focusBlockItem(): PlanItem {
	return {
		id: "focus_block",
		kind: "focus_block",
		title: "Start a 50-minute focus session",
		reason: "Nothing urgent today. Use the time to build a skill or polish a project.",
		href: "/focus?task=Focus%20block&ref=focus_block",
		done: false,
	};
}

const FILLER_ITEMS: readonly PlanItem[] = [
	{
		id: "job_inbox",
		kind: "job_inbox",
		title: "Skim your Job Inbox",
		reason: "Shortlist anything worth a closer look, skip the rest.",
		href: "/jobs",
		done: false,
	},
	{
		id: "profile",
		kind: "profile",
		title: "Add one recent win to your profile",
		reason: "Fresh results make every tailored resume stronger.",
		href: "/profile",
		done: false,
	},
];

/** Rule-based next step; the first matching rule wins. */
export function pickNextStep(signals: TodaySignals): PlanItem {
	const interview = upcomingInterviews(signals)[0];
	if (interview) return interviewPrepItem(interview, signals.timeZone);
	const followUp = dueFollowUps(signals)[0];
	if (followUp) return followUpItem(followUp);
	if (signals.lesson) return lessonItem(signals.lesson);
	if (signals.strongMatchCount > 0) return reviewMatchesItem(signals.strongMatchCount);
	return focusBlockItem();
}

/** Every rule-driven item, in rule order (several interviews/follow-ups allowed). */
function ruleItems(signals: TodaySignals): PlanItem[] {
	const items: PlanItem[] = [
		...upcomingInterviews(signals).map((i) => interviewPrepItem(i, signals.timeZone)),
		...dueFollowUps(signals).map(followUpItem),
	];
	if (signals.lesson) items.push(lessonItem(signals.lesson));
	if (signals.strongMatchCount > 0) items.push(reviewMatchesItem(signals.strongMatchCount));
	return items;
}

/**
 * Daily plan of MIN_PLAN_ITEMS..MAX_PLAN_ITEMS items. The next step is always first;
 * a focus block is always included; fillers top it up to the minimum.
 */
export function buildDailyPlan(signals: TodaySignals): PlanItem[] {
	const plan = ruleItems(signals).slice(0, MAX_PLAN_ITEMS - 1);
	plan.push(focusBlockItem());
	for (const filler of FILLER_ITEMS) {
		if (plan.length >= MIN_PLAN_ITEMS) break;
		plan.push({ ...filler });
	}
	return plan;
}

/** Keeps `done` for items that survive a regenerate. */
export function carryOverDone(next: readonly PlanItem[], previous: readonly PlanItem[]): PlanItem[] {
	const done = new Set(previous.filter((p) => p.done).map((p) => p.id));
	return next.map((item) => ({ ...item, done: done.has(item.id) }));
}

/** Applies a check-off to one item; returns null when the item is not in today's plan. */
export function toggleItem(items: readonly PlanItem[], itemId: string, done: boolean): PlanItem[] | null {
	if (!items.some((i) => i.id === itemId)) return null;
	return items.map((i) => (i.id === itemId ? { ...i, done } : i));
}
