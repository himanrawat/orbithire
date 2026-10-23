/** Career stages and goal suggestions for onboarding (PRD v2, area 1). No server imports. */

export const CAREER_STAGES = ["student", "early", "experienced", "leader"] as const;
export type CareerStage = (typeof CAREER_STAGES)[number];

export const ONBOARDING_LIMITS = {
	goals: 12,
	goalLength: 120,
	targetRoleLength: 120,
	locations: 10,
	locationLength: 100,
	maxFocusHours: 80,
} as const;

export type StageInfo = Readonly<{
	label: string;
	years: string;
	description: string;
}>;

export const STAGE_INFO: Readonly<Record<CareerStage, StageInfo>> = {
	student: {
		label: "Student",
		years: "College, bootcamp or new grad",
		description: "Learn the fundamentals, build projects and land an internship or first job.",
	},
	early: {
		label: "Early career",
		years: "0–3 years",
		description: "Find a better-fitting role and get through interviews faster.",
	},
	experienced: {
		label: "Experienced",
		years: "3–10 years",
		description: "Reach the next level or make a move, without telling anyone.",
	},
	leader: {
		label: "Leader",
		years: "10+ years",
		description: "Lead in public, mentor others and prepare for leadership loops.",
	},
};

export const GOAL_SUGGESTIONS: Readonly<Record<CareerStage, readonly string[]>> = {
	student: [
		"Land an internship",
		"Get my first full-time job",
		"Learn the fundamentals",
		"Build portfolio projects",
		"Practice common interview questions",
		"Write my first resume",
	],
	early: [
		"Find a better-fitting role",
		"Interview faster",
		"Tailor my resume to each job",
		"Grow into a mid-level role",
		"Negotiate a higher salary",
		"Practice behavioral interviews",
	],
	experienced: [
		"Reach the next level",
		"Change direction or industry",
		"Close my skill gaps",
		"Prepare for system design interviews",
		"Protect focus time",
		"Look for roles privately",
	],
	leader: [
		"Prepare for leadership interviews",
		"Share milestones in public",
		"Mentor others",
		"Move into a staff or director role",
		"Build my professional reputation",
		"Keep my options open quietly",
	],
};

export const FOCUS_HOUR_OPTIONS = [2, 4, 6, 10, 15] as const;

export function isCareerStage(value: unknown): value is CareerStage {
	return typeof value === "string" && (CAREER_STAGES as readonly string[]).includes(value);
}

/** Trim, drop empties, de-duplicate case-insensitively and cap the list. */
export function normalizeList(values: readonly string[], max: number, maxLength: number): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim().slice(0, maxLength);
		const key = value.toLowerCase();
		if (!value || seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= max) break;
	}
	return out;
}

/** Goals to show as checkboxes: the stage's suggestions, then any custom goals already chosen. */
export function goalOptionsFor(stage: CareerStage | null, chosen: readonly string[]): string[] {
	const suggestions = stage ? GOAL_SUGGESTIONS[stage] : GOAL_SUGGESTIONS.early;
	return normalizeList([...suggestions, ...chosen], 40, ONBOARDING_LIMITS.goalLength);
}

/** Toggle one entry in a list, keeping order and the maximum size. */
export function toggleInList(list: readonly string[], value: string, max: number): string[] {
	if (list.includes(value)) return list.filter((item) => item !== value);
	if (list.length >= max) return [...list];
	return [...list, value];
}

export const COMPLETION_COOKIE = "nm_onboarding_seen";

/** Send someone to setup only if they never finished it and haven't already been shown it. */
export function needsOnboarding(onboardedAt: string | null | undefined, seenCookie: boolean): boolean {
	return !onboardedAt && !seenCookie;
}
