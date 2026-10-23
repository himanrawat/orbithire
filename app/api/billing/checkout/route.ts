import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import type { User } from "@supabase/supabase-js";
import { parseJson } from "@/lib/api";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { renewalTerms, type BillingInterval } from "@/lib/billing/prices";
import { resolvePlan, isBillingEnabled } from "@/lib/billing/plan";
import { checkoutSchema } from "@/lib/billing/schemas";
import {
	billingDisabledResponse,
	billingReturnUrl,
	ensureStripeCustomer,
	getStripe,
	getSubscriptionRow,
	priceIdFor,
	requireBillingUser,
	upsertSubscription,
} from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionParams(
	user: User,
	customerId: string,
	interval: BillingInterval,
	acceptedAt: string
): Stripe.Checkout.SessionCreateParams {
	const metadata = { user_id: user.id, interval, renewal_terms_accepted_at: acceptedAt };
	return {
		mode: "subscription",
		customer: customerId,
		client_reference_id: user.id,
		line_items: [{ price: priceIdFor(interval), quantity: 1 }],
		metadata,
		subscription_data: { metadata },
		// Repeat the auto-renewal terms beside Stripe's pay button.
		custom_text: { submit: { message: renewalTerms(interval) } },
		success_url: billingReturnUrl("&checkout=success"),
		cancel_url: billingReturnUrl("&checkout=canceled"),
	};
}

/**
 * POST /api/billing/checkout { interval, acceptRenewalTerms: true } — starts a Stripe
 * Checkout Session (subscription mode) and records when the renewal terms were accepted.
 */
export async function POST(req: NextRequest) {
	const stripe = getStripe();
	if (!stripe || !isBillingEnabled()) return billingDisabledResponse();

	const auth = await requireBillingUser();
	if (auth instanceof NextResponse) return auth;
	const { user } = auth;

	const limited = await enforceRateLimit(req, {
		scope: "billing.checkout",
		limit: 10,
		windowSeconds: 60 * 60,
		identifier: user.id,
	});
	if (limited) return limited;

	const parsed = await parseJson(req, checkoutSchema);
	if (!parsed.success) return parsed.response;

	try {
		const row = await getSubscriptionRow(user.id);
		if (resolvePlan(row, true) === "pro") {
			return NextResponse.json(
				{ error: "You're already on Pro. Use Manage payment to change your plan." },
				{ status: 409 }
			);
		}
		const customerId = await ensureStripeCustomer(stripe, user, row);
		const acceptedAt = new Date().toISOString();
		await upsertSubscription(user.id, {
			stripe_customer_id: customerId,
			renewal_terms_accepted_at: acceptedAt,
		});
		const session = await stripe.checkout.sessions.create(
			sessionParams(user, customerId, parsed.data.interval, acceptedAt)
		);
		return NextResponse.json({ url: session.url });
	} catch (error) {
		console.error("[billing/checkout]", error);
		return NextResponse.json({ error: "We couldn't start checkout. Please try again." }, { status: 502 });
	}
}
