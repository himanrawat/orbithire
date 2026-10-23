/**
 * Client-safe copy and response shapes for plan gates (PRD area 10). Routes return
 * `planRequiredBody(feature)` with status 403 when a Pro feature is closed; the UI shows
 * the same message with an "Upgrade to Pro" link to UPGRADE_HREF. Plain copy, no
 * countdowns or pressure.
 */
import { PLAN_LIMITS } from "./limits";

export const UPGRADE_HREF = "/pricing";
export const PLAN_REQUIRED_CODE = "plan_required";

export type GatedFeature = "voice_answers" | "mock_interviews" | "calendar_sync" | "learning_paths";

const FREE_PATHS = PLAN_LIMITS.free.learning_paths ?? 1;

const GATE_MESSAGES: Readonly<Record<GatedFeature, string>> = {
	voice_answers: "Voice answers are part of Pro. You can still type your answer on Free.",
	mock_interviews: "Timed mock interviews are part of Pro. Single-question practice stays free.",
	calendar_sync: "Google Calendar sync is part of Pro.",
	learning_paths: `Free includes ${FREE_PATHS} learning path, the first one you start. Pro opens every path.`,
};

export function gateMessage(feature: GatedFeature): string {
	return GATE_MESSAGES[feature];
}

export type PlanRequiredBody = Readonly<{
	error: string;
	code: typeof PLAN_REQUIRED_CODE;
	feature: GatedFeature;
	upgradeUrl: string;
}>;

export function planRequiredBody(feature: GatedFeature): PlanRequiredBody {
	return { error: gateMessage(feature), code: PLAN_REQUIRED_CODE, feature, upgradeUrl: UPGRADE_HREF };
}

/** AI feedback quota as the UI sees it; null when unlimited (Pro, own key, billing off). */
export type FeedbackQuota = Readonly<{ limit: number; used: number; remaining: number }> | null;

export function feedbackQuota(limit: number | null, used: number): FeedbackQuota {
	if (limit === null) return null;
	return { limit, used, remaining: Math.max(limit - used, 0) };
}

/** The quota after one more review was given (or not). */
export function afterReview(quota: FeedbackQuota, reviewed: boolean): FeedbackQuota {
	if (!quota || !reviewed) return quota;
	return feedbackQuota(quota.limit, quota.used + 1);
}

/** Shown before submitting, e.g. "6 of 10 free AI reviews left this month." */
export function feedbackRemainingText(quota: FeedbackQuota): string | null {
	if (!quota) return null;
	const noun = quota.limit === 1 ? "review" : "reviews";
	return `${quota.remaining} of ${quota.limit} free AI ${noun} left this month.`;
}

/** Shown after a capped answer is saved without feedback. */
export function feedbackLimitReachedText(limit: number): string {
	return `Your answer is saved. You've used your ${limit} free reviews this month. They reset on the 1st of next month. Pro, or your own AI key in Settings, gives unlimited feedback.`;
}
