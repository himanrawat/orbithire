/**
 * Plan gates for interview prep (PRD area 10), as pure rules. Client-safe: the server
 * builds this from getPlan() + the month's review count and sends it to the practice UI.
 */
import { canUse, limitFor, type PlanContext } from "@/lib/billing/limits";
import { feedbackQuota, type FeedbackQuota } from "@/lib/billing/gates";

type Ctx = Pick<PlanContext, "plan" | "hasOwnAiKey" | "billingEnabled">;

export type PrepAccess = Readonly<{
	voice: boolean;
	mock: boolean;
	/** null = unlimited AI feedback. */
	feedback: FeedbackQuota;
}>;

/** Whether this month's review count must be looked up at all. */
export function feedbackIsMetered(ctx: Ctx): boolean {
	return limitFor(ctx, "ai_feedback") !== null;
}

export function buildPrepAccess(ctx: Ctx, feedbackUsed: number): PrepAccess {
	return {
		voice: canUse(ctx, "voice_answers"),
		mock: canUse(ctx, "mock_interviews"),
		feedback: feedbackQuota(limitFor(ctx, "ai_feedback"), feedbackUsed),
	};
}

export function canGetFeedback(access: PrepAccess): boolean {
	return access.feedback === null || access.feedback.remaining > 0;
}

type AttemptKind = Readonly<{ inputMode: "text" | "voice"; mockId?: string | null }>;

/** The Pro feature an attempt needs but the user lacks, or null when it may be saved. */
export function blockedAttemptFeature(access: PrepAccess, attempt: AttemptKind): "voice_answers" | "mock_interviews" | null {
	if (attempt.mockId && !access.mock) return "mock_interviews";
	if (attempt.inputMode === "voice" && !access.voice) return "voice_answers";
	return null;
}
