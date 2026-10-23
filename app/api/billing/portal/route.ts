import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit } from "@/lib/requestSecurity";
import {
	billingDisabledResponse,
	billingReturnUrl,
	getStripe,
	getSubscriptionRow,
	requireBillingUser,
} from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/billing/portal — a Stripe Customer Portal session (payment method, invoices). */
export async function POST(req: NextRequest) {
	const stripe = getStripe();
	if (!stripe) return billingDisabledResponse();

	const auth = await requireBillingUser();
	if (auth instanceof NextResponse) return auth;

	const limited = await enforceRateLimit(req, {
		scope: "billing.portal",
		limit: 20,
		windowSeconds: 60 * 60,
		identifier: auth.user.id,
	});
	if (limited) return limited;

	try {
		const row = await getSubscriptionRow(auth.user.id);
		if (!row?.stripe_customer_id) {
			return NextResponse.json({ error: "There's no billing account yet." }, { status: 404 });
		}
		const session = await stripe.billingPortal.sessions.create({
			customer: row.stripe_customer_id,
			return_url: billingReturnUrl(),
		});
		return NextResponse.json({ url: session.url });
	} catch (error) {
		console.error("[billing/portal]", error);
		return NextResponse.json({ error: "We couldn't open the billing portal. Please try again." }, { status: 502 });
	}
}
