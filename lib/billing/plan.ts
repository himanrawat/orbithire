/**
 * Plans and feature limits (PRD area 10). The stable API other features call:
 *
 *   const ctx = await getPlan(user.id);            // server only
 *   if (!canUse(ctx, "mock_interviews")) return upgradeRequired();
 *   if (!canUse(ctx, "ai_feedback", reviewsThisMonth)) return limitReached();
 *   limitFor(ctx, "learning_paths");               // 1 on Free, null = unlimited
 *
 * - `PLAN_LIMITS` is the single lookup table. A limit of `null` means unlimited, `0`
 *   means not included, any other number is a cap (per month for `ai_feedback`, active
 *   at once for `learning_paths`).
 * - Users who bring their own AI key keep unlimited AI on Free: the metered AI features
 *   in `BYO_KEY_UNLIMITED` are uncapped for them. Pro-only features stay Pro-only.
 * - Tailored resumes on Free stay metered by the existing generation credits
 *   (`reserve_generation_credit`); Pro and own-key users are unlimited there too.
 * - When billing is off (no Stripe env), everyone gets Free rules.
 *
 * Client components import the pure rules from "@/lib/billing/limits" (re-exported here).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPlanContext, normalizeSubscriptionRow, type PlanContext } from "./limits";

export * from "./limits";

export function isBillingEnabled(): boolean {
	return (
		process.env.NEXT_PUBLIC_BILLING_ENABLED === "true" &&
		Boolean(process.env.STRIPE_SECRET_KEY) &&
		Boolean(process.env.STRIPE_PRICE_PRO_MONTHLY) &&
		Boolean(process.env.STRIPE_PRICE_PRO_ANNUAL)
	);
}

async function defaultClient(): Promise<SupabaseClient> {
	const { createServiceSupabase } = await import("@/lib/supabaseServer");
	return createServiceSupabase();
}

/**
 * Server only. The user's plan plus whether they have their own AI key. Uses the
 * service role unless a client is passed (a user-scoped client works too: RLS lets
 * users read their own subscription and settings).
 */
export async function getPlan(userId: string, client?: SupabaseClient): Promise<PlanContext> {
	const billingEnabled = isBillingEnabled();
	const supabase = client ?? (await defaultClient());
	const [subscription, settings] = await Promise.all([
		billingEnabled
			? supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle()
			: Promise.resolve({ data: null, error: null }),
		supabase.from("user_settings").select("ai_api_key_encrypted").eq("user_id", userId).maybeSingle(),
	]);
	if (subscription.error) console.error("[billing] plan lookup:", subscription.error.message);
	const key = (settings.data as { ai_api_key_encrypted?: unknown } | null)?.ai_api_key_encrypted;
	return buildPlanContext(normalizeSubscriptionRow(subscription.data as Record<string, unknown> | null), {
		billingEnabled,
		hasOwnAiKey: typeof key === "string" && key.length > 0,
	});
}
