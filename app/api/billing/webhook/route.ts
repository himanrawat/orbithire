import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/server";
import { handleBillingEvent, isEventProcessed, recordEvent } from "@/lib/billing/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyEvent(stripe: Stripe, rawBody: string, signature: string | null): Stripe.Event | null {
	const secret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!secret || !signature) return null;
	try {
		return stripe.webhooks.constructEvent(rawBody, signature, secret);
	} catch {
		return null;
	}
}

/**
 * POST /api/billing/webhook — Stripe events. The raw body is verified against
 * STRIPE_WEBHOOK_SECRET; billing_events makes retries idempotent. A failure returns
 * 500 so Stripe retries the delivery.
 */
export async function POST(req: NextRequest) {
	const stripe = getStripe();
	if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
		return NextResponse.json({ error: "Billing isn't configured." }, { status: 404 });
	}

	const rawBody = await req.text();
	const event = verifyEvent(stripe, rawBody, req.headers.get("stripe-signature"));
	if (!event) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });

	try {
		if (await isEventProcessed(event.id)) {
			return NextResponse.json({ received: true, duplicate: true });
		}
		const note = await handleBillingEvent(stripe, event);
		await recordEvent(event, true);
		return NextResponse.json({ received: true, result: note });
	} catch (error) {
		console.error(`[billing/webhook] ${event.type} ${event.id}:`, error);
		await recordEvent(event, false).catch((recordError: unknown) => {
			console.error("[billing/webhook] could not record failed event:", recordError);
		});
		return NextResponse.json({ error: "Processing failed." }, { status: 500 });
	}
}
