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
	learningLogAvailable: boolean;
};
