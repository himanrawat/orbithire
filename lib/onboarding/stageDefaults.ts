/**
 * Per-stage defaults other features can import (PRD v2, area 1 "Should"; section 4).
 * The stage changes emphasis and defaults, never the app's structure.
 */

import type { CareerStage } from "./stages";

/** The kinds of items a Today plan can hold; they match the `--kind-*` color tokens. */
export type TodayKind = "jobs" | "learn" | "prep" | "focus" | "interview";

export type StageDefaults = Readonly<{
	/** Sidebar hrefs in the order to emphasize them. Hrefs that don't exist yet are ignored. */
	sidebarOrder: readonly string[];
	/** Relative weight of each item kind in the daily plan. Weights add up to 1. */
	todayWeights: Readonly<Record<TodayKind, number>>;
	/** The weekly focus goal suggested when someone skips the rhythm step. */
	weeklyFocusHours: number;
}>;

export const STAGE_DEFAULTS: Readonly<Record<CareerStage, StageDefaults>> = {
	student: {
		sidebarOrder: ["/dashboard", "/learn", "/prep", "/generate", "/resumes", "/jobs", "/companies", "/templates"],
		todayWeights: { learn: 0.35, prep: 0.25, focus: 0.2, jobs: 0.15, interview: 0.05 },
		weeklyFocusHours: 6,
	},
	early: {
		sidebarOrder: ["/dashboard", "/jobs", "/generate", "/prep", "/companies", "/resumes", "/learn", "/templates"],
		todayWeights: { jobs: 0.35, prep: 0.25, interview: 0.15, learn: 0.1, focus: 0.15 },
		weeklyFocusHours: 4,
	},
	experienced: {
		sidebarOrder: ["/dashboard", "/learn", "/prep", "/focus", "/jobs", "/companies", "/generate", "/resumes", "/templates"],
		todayWeights: { learn: 0.25, prep: 0.25, focus: 0.25, jobs: 0.15, interview: 0.1 },
		weeklyFocusHours: 4,
	},
	leader: {
		sidebarOrder: ["/dashboard", "/milestones", "/community", "/prep", "/jobs", "/companies", "/generate", "/resumes", "/templates"],
		todayWeights: { prep: 0.3, focus: 0.25, learn: 0.15, jobs: 0.15, interview: 0.15 },
		weeklyFocusHours: 2,
	},
};

/** Used when someone hasn't picked a stage: the jobs-first defaults the app had before v2. */
export const FALLBACK_STAGE: CareerStage = "early";

export function stageDefaultsFor(stage: CareerStage | null | undefined): StageDefaults {
	return STAGE_DEFAULTS[stage ?? FALLBACK_STAGE];
}

/**
 * Sort nav items by the stage's emphasis order. Items not in the order keep their
 * original relative position after the ordered ones.
 */
export function orderByStage<T extends { href: string }>(items: readonly T[], stage: CareerStage | null | undefined): T[] {
	const order = stageDefaultsFor(stage).sidebarOrder;
	const rank = (href: string) => {
		const index = order.indexOf(href);
		return index === -1 ? order.length : index;
	};
	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => rank(a.item.href) - rank(b.item.href) || a.index - b.index)
		.map(({ item }) => item);
}
