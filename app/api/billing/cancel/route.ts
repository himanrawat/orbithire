import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { cancelSchema } from "@/lib/billing/schemas";
import {
	billingDisabledResponse,
	getStripe,
	getSubscriptionRow,
	requireBillingUser,
	syncSubscription,
} from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/billing/cancel {} — cancels Pro at the end of the paid period, directly
 * (no portal detour). { resume: true } undoes a pending cancel.
 */
export async function POST(req: NextRequest) {
	const stripe = getStripe();
	if (!stripe) return billingDisabledResponse();

	const auth = await requireBillingUser();
	if (auth instanceof NextResponse) return auth;
	const userId = auth.user.id;

	const limited = await enforceRateLimit(req, {
		scope: "billing.cancel",
		limit: 20,
		windowSeconds: 60 * 60,
		identifier: userId,
	});
	if (limited) return limited;

	const parsed = await parseJson(req, cancelSchema);
	if (!parsed.success) return parsed.response;

	try {
		const row = await getSubscriptionRow(userId);
		if (!row?.stripe_subscription_id || row.status === "canceled") {
			return NextResponse.json({ error: "You don't have an active plan to cancel." }, { status: 404 });
		}
		const subscription = await stripe.subscriptions.update(row.stripe_subscription_id, {
			cancel_at_period_end: !parsed.data.resume,
		});
		const updated = await syncSubscription(userId, subscription);
		return NextResponse.json({
			cancelAtPeriodEnd: updated?.cancel_at_period_end ?? !parsed.data.resume,
			currentPeriodEnd: updated?.current_period_end ?? null,
		});
	} catch (error) {
		console.error("[billing/cancel]", error);
		return NextResponse.json(
			{ error: "We couldn't update your plan. Please try again, or email info@himanshurawat.in." },
			{ status: 502 }
		);
	}
}
