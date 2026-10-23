import "server-only";

import type Stripe from "stripe";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { enqueueTask } from "@/lib/tasks";
import {
	findUserIdByStripe,
	getSubscriptionRow,
	syncSubscription,
} from "./server";
import {
	buildRenewalReminder,
	expandableId,
	invoiceSubscriptionId,
	isHandledEvent,
	type HandledEvent,
} from "./stripeSync";

/** Whether the event was already handled (a retry or a duplicate delivery). */
export async function isEventProcessed(eventId: string): Promise<boolean> {
	const { data, error } = await createServiceSupabase()
		.from("billing_events")
		.select("processed_at")
		.eq("stripe_event_id", eventId)
		.maybeSingle();
	if (error) throw new Error(`billing_events lookup failed: ${error.message}`);
	return Boolean((data as { processed_at?: string | null } | null)?.processed_at);
}

export async function recordEvent(event: Stripe.Event, processed: boolean): Promise<void> {
	const { error } = await createServiceSupabase()
		.from("billing_events")
		.upsert(
			{
				stripe_event_id: event.id,
				type: event.type,
				payload: event as unknown as Record<string, unknown>,
				processed_at: processed ? new Date().toISOString() : null,
			},
			{ onConflict: "stripe_event_id" }
		);
	if (error) throw new Error(`billing_events write failed: ${error.message}`);
}

async function onCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session): Promise<string> {
	if (session.mode !== "subscription") return "not a subscription checkout";
	const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
	const subscriptionId = expandableId(session.subscription);
	if (!userId || !subscriptionId) return "missing user or subscription";
	const subscription = await stripe.subscriptions.retrieve(subscriptionId);
	const acceptedAt = session.metadata?.renewal_terms_accepted_at;
	await syncSubscription(userId, subscription, acceptedAt ? { renewal_terms_accepted_at: acceptedAt } : {});
	return "synced";
}

async function onSubscriptionChanged(
	stripe: Stripe,
	subscription: Stripe.Subscription,
	deleted: boolean
): Promise<string> {
	const userId =
		subscription.metadata?.user_id ??
		(await findUserIdByStripe("stripe_customer_id", expandableId(subscription.customer)));
	if (!userId) return "unknown customer";
	// Events can arrive out of order: mirror Stripe's current state, not the event's copy.
	const current = deleted ? subscription : await stripe.subscriptions.retrieve(subscription.id);
	await syncSubscription(userId, current, {}, deleted || current.status === "canceled");
	return "synced";
}

async function onInvoiceUpcoming(invoice: Stripe.Invoice, eventId: string): Promise<string> {
	const userId = await findUserIdByStripe("stripe_subscription_id", invoiceSubscriptionId(invoice));
	if (!userId) return "unknown subscription";
	const row = await getSubscriptionRow(userId);
	if (!row) return "no subscription row";
	const payload = buildRenewalReminder(invoice, row, eventId);
	if (!payload) return "no reminder needed";
	await enqueueTask("billing_reminder", payload, { userId, priority: 5 });
	return "reminder queued";
}

const SUBSCRIPTION_EVENTS: ReadonlySet<HandledEvent> = new Set<HandledEvent>([
	"customer.subscription.created",
	"customer.subscription.updated",
	"customer.subscription.deleted",
]);

/** Apply one verified Stripe event. Returns a short note for logs. */
export async function handleBillingEvent(stripe: Stripe, event: Stripe.Event): Promise<string> {
	const type = event.type;
	if (!isHandledEvent(type)) return "ignored";
	if (type === "checkout.session.completed") {
		return onCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
	}
	if (SUBSCRIPTION_EVENTS.has(type)) {
		return onSubscriptionChanged(
			stripe,
			event.data.object as Stripe.Subscription,
			type === "customer.subscription.deleted"
		);
	}
	return onInvoiceUpcoming(event.data.object as Stripe.Invoice, event.id);
}
