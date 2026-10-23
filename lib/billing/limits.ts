/**
 * Pure plan rules (client-safe). Import from "@/lib/billing/plan" on the server; it
 * re-exports everything here plus getPlan(). See plan.ts for the API overview.
 */
import { isBillingInterval, type BillingInterval } from "./prices";

export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const FEATURES = [
	"job_tracking",
	"learning_log",
	"community",
	"learning_paths",
	"ai_feedback",
	"tailored_resumes",
	"voice_answers",
	"mock_interviews",
	"calendar_sync",
] as const;
export type Feature = (typeof FEATURES)[number];

/** null = unlimited, 0 = not included, n = cap. */
export type Limit = number | null;

export const PLAN_LIMITS: Readonly<Record<PlanId, Readonly<Record<Feature, Limit>>>> = {
	free: {
		job_tracking: null,
		learning_log: null,
		community: null,
		learning_paths: 1,
		ai_feedback: 10,
		// Metered by generation credits (ai_credits), not by this table.
		tailored_resumes: null,
		voice_answers: 0,
		mock_interviews: 0,
		calendar_sync: 0,
	},
	pro: {
		job_tracking: null,
		learning_log: null,
		community: null,
		learning_paths: null,
		ai_feedback: null,
		tailored_resumes: null,
		voice_answers: null,
		mock_interviews: null,
		calendar_sync: null,
	},
};

/** Capped AI features that an own API key makes unlimited on Free. */
export const BYO_KEY_UNLIMITED: ReadonlySet<Feature> = new Set<Feature>(["ai_feedback", "tailored_resumes"]);

export const SUBSCRIPTION_STATUSES = [
	"none",
	"active",
	"trialing",
	"past_due",
	"unpaid",
	"canceled",
	"incomplete",
	"incomplete_expired",
	"paused",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses that keep Pro (past_due: Stripe is still retrying the card). */
export const ACCESS_STATUSES: ReadonlySet<SubscriptionStatus> = new Set<SubscriptionStatus>([
	"active",
	"trialing",
	"past_due",
]);

/** A day of grace after current_period_end, so a late renewal webhook never drops access. */
const PERIOD_GRACE_MS = 24 * 60 * 60 * 1000;

export type SubscriptionRow = Readonly<{
	user_id: string;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	plan: PlanId;
	status: SubscriptionStatus;
	interval: BillingInterval | null;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
	renewal_terms_accepted_at: string | null;
	updated_at: string;
}>;

export type PlanContext = Readonly<{
	plan: PlanId;
	hasOwnAiKey: boolean;
	billingEnabled: boolean;
	status: SubscriptionStatus;
	interval: BillingInterval | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
}>;

export function isPlanId(value: unknown): value is PlanId {
	return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
	return typeof value === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

type PlanRowFields = Pick<SubscriptionRow, "plan" | "status" | "current_period_end">;

/** Same rule as billing_has_active_pro() in the 20261024001000 migration. */
export function resolvePlan(row: PlanRowFields | null, billingEnabled: boolean, now: Date = new Date()): PlanId {
	if (!billingEnabled || !row) return "free";
	if (row.plan !== "pro" || !ACCESS_STATUSES.has(row.status)) return "free";
	if (!row.current_period_end) return "pro";
	const end = Date.parse(row.current_period_end);
	if (Number.isNaN(end)) return "pro";
	return end + PERIOD_GRACE_MS > now.getTime() ? "pro" : "free";
}

export function buildPlanContext(
	row: SubscriptionRow | null,
	options: Readonly<{ billingEnabled: boolean; hasOwnAiKey: boolean; now?: Date }>
): PlanContext {
	return {
		plan: resolvePlan(row, options.billingEnabled, options.now),
		hasOwnAiKey: options.hasOwnAiKey,
		billingEnabled: options.billingEnabled,
		status: row?.status ?? "none",
		interval: row?.interval ?? null,
		currentPeriodEnd: row?.current_period_end ?? null,
		cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
	};
}

type LimitContext = Pick<PlanContext, "plan" | "hasOwnAiKey">;

/** The cap for a feature in this context: null = unlimited, 0 = not included. */
export function limitFor(ctx: LimitContext, feature: Feature): Limit {
	const limit = PLAN_LIMITS[ctx.plan][feature];
	if (limit !== null && limit > 0 && ctx.hasOwnAiKey && BYO_KEY_UNLIMITED.has(feature)) return null;
	return limit;
}

/**
 * Whether the user may use a feature. Pass `used` (e.g. AI reviews this month, active
 * paths) for capped features; without it, a capped feature counts as available.
 */
export function canUse(ctx: LimitContext, feature: Feature, used = 0): boolean {
	const limit = limitFor(ctx, feature);
	if (limit === null) return true;
	return used < limit;
}

/** Remaining uses of a capped feature, or null when unlimited. */
export function remainingFor(ctx: LimitContext, feature: Feature, used: number): number | null {
	const limit = limitFor(ctx, feature);
	if (limit === null) return null;
	return Math.max(limit - used, 0);
}

export function normalizeSubscriptionRow(raw: Record<string, unknown> | null): SubscriptionRow | null {
	if (!raw || typeof raw.user_id !== "string") return null;
	const text = (value: unknown) => (typeof value === "string" ? value : null);
	return {
		user_id: raw.user_id,
		stripe_customer_id: text(raw.stripe_customer_id),
		stripe_subscription_id: text(raw.stripe_subscription_id),
		plan: isPlanId(raw.plan) ? raw.plan : "free",
		status: isSubscriptionStatus(raw.status) ? raw.status : "none",
		interval: isBillingInterval(raw.interval) ? raw.interval : null,
		current_period_end: text(raw.current_period_end),
		cancel_at_period_end: raw.cancel_at_period_end === true,
		renewal_terms_accepted_at: text(raw.renewal_terms_accepted_at),
		updated_at: text(raw.updated_at) ?? new Date(0).toISOString(),
	};
}

