/** Today API response types, shared by the route and client components (no server imports). */
import type { PlanItem } from "./nextStep";

export type TodayMatch = {
	id: string;
	title: string;
	company: string | null;
	location: string | null;
	isRemote: boolean;
	score: number | null;
};

export type ComingUpItem = {
	id: string;
	kind: "interview" | "follow_up" | "focus";
	title: string;
	at: string;
	href: string;
};

export type WeeklyFocus = {
	/** Focus minutes logged in the last 7 days (lib/focus/totals.ts). */
	minutes: number;
	goalHours: number | null;
};

export type TodayPlan = {
	date: string;
	items: PlanItem[];
	generatedAt: string;
};

export type WeekDay = {
	date: string;
	label: string;
	/** active: a plan item was done that day; open: a past day without one. */
	state: "active" | "today" | "open" | "upcoming";
};

export type TodayPost = {
	id: string;
	type: string;
	title: string;
	authorName: string;
	helpfulCount: number;
	replyCount: number;
};

export type TodayPerson = {
	userId: string;
	displayName: string;
	headline: string | null;
	careerStage: string | null;
};

/** Community preview for members; null when the person isn't an active member. */
export type TodayCommunity = {
	posts: TodayPost[];
	people: TodayPerson[];
};

export type TodayData = {
	firstName: string | null;
	timeZone: string;
	date: string;
	nextStep: PlanItem;
	nextStepDismissed: boolean;
	plan: TodayPlan | null;
	matches: TodayMatch[];
	comingUp: ComingUpItem[];
	weeklyFocus: WeeklyFocus | null;
	week: WeekDay[];
	community: TodayCommunity | null;
};
