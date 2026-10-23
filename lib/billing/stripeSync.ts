/**
 * Pure mapping from Stripe objects to our `subscriptions` row and reminder payloads.
 * Typed against the minimal shapes we read, so tests can pass plain objects and API
 * version changes stay contained here (since 2025-03-31 the billing period lives on
 * the subscription items, and an invoice names its subscription under
 * parent.subscription_details).
 */
import { isBillingInterval, type BillingInterval } from "./prices";
import { isSubscriptionStatus, type PlanId, type SubscriptionStatus } from "./limits";

type Expandable = string | { id: string } | null | undefined;

export type StripeSubscriptionLike = Readonly<{
	id: string;
	customer: Expandable;
	status: string;
	cancel_at_period_end: boolean;
	cancel_at?: number | null;
	metadata?: Record<string, string> | null;
	current_period_end?: number | null;
	items?: Readonly<{
		data: ReadonlyArray<
			Readonly<{
				current_period_end?: number | null;
				price?: Readonly<{ id?: string; recurring?: Readonly<{ interval?: string }> | null }> | null;
			}>
		>;
	}>;
}>;

export type StripeInvoiceLike = Readonly<{
	customer: Expandable;
	amount_due: number;
	currency: string;
	next_payment_attempt?: number | null;
	period_end?: number | null;
	subscription?: Expandable;
	parent?: Readonly<{
		subscription_details?: Readonly<{ subscription?: Expandable }> | null;
	}> | null;
}>;

export type SubscriptionSync = {
	stripe_subscription_id: string;
	stripe_customer_id: string | null;
	plan: PlanId;
	status: SubscriptionStatus;
	interval: BillingInterval | null;
	current_period_end: string | null;
	cancel_at_period_end: boolean;
};

/** Statuses after which the subscription can never become active again. */
const ENDED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set<SubscriptionStatus>([
	"canceled",
	"incomplete_expired",
]);

export function expandableId(value: Expandable): string | null {
	if (!value) return null;
	return typeof value === "string" ? value : value.id;
}

export function unixToIso(seconds: number | null | undefined): string | null {
	return typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;
}

function periodEnd(sub: StripeSubscriptionLike): number | null {
	const itemEnds = (sub.items?.data ?? [])
		.map((item) => item.current_period_end)
		.filter((end): end is number => typeof end === "number");
	if (itemEnds.length > 0) return Math.min(...itemEnds);
	return sub.current_period_end ?? null;
}

function subscriptionInterval(sub: StripeSubscriptionLike): BillingInterval | null {
	const interval = sub.items?.data[0]?.price?.recurring?.interval;
	return isBillingInterval(interval) ? interval : null;
}

/** Row fields for a Stripe subscription. `deleted` forces the ended state. */
export function subscriptionToSync(sub: StripeSubscriptionLike, deleted = false): SubscriptionSync {
	const status: SubscriptionStatus = deleted || !isSubscriptionStatus(sub.status) ? "canceled" : sub.status;
	return {
		stripe_subscription_id: sub.id,
		stripe_customer_id: expandableId(sub.customer),
		plan: ENDED_STATUSES.has(status) ? "free" : "pro",
		status,
		interval: subscriptionInterval(sub),
		current_period_end: unixToIso(periodEnd(sub)),
		// A scheduled cancel (cancel_at) is also "won't renew" from the user's point of view.
		cancel_at_period_end: sub.cancel_at_period_end || Boolean(sub.cancel_at),
	};
}

export function invoiceSubscriptionId(invoice: StripeInvoiceLike): string | null {
	return expandableId(invoice.parent?.subscription_details?.subscription) ?? expandableId(invoice.subscription);
}

export type RenewalReminderPayload = {
	user_id: string;
	amount_cents: number;
	currency: string;
	renewal_date: string;
	interval: BillingInterval;
	event_id: string;
};

/**
 * The billing_reminder task payload for an `invoice.upcoming` event, or null when no
 * reminder is due (monthly plans, or a subscription that is set to end).
 */
export function buildRenewalReminder(
	invoice: StripeInvoiceLike,
	row: Readonly<{ user_id: string; interval: BillingInterval | null; cancel_at_period_end: boolean }>,
	eventId: string
): RenewalReminderPayload | null {
	if (row.interval !== "year" || row.cancel_at_period_end) return null;
	const renewal = unixToIso(invoice.next_payment_attempt ?? invoice.period_end);
	if (!renewal) return null;
	return {
		user_id: row.user_id,
		amount_cents: invoice.amount_due,
		currency: invoice.currency.toLowerCase(),
		renewal_date: renewal,
		interval: "year",
		event_id: eventId,
	};
}

export const HANDLED_EVENTS = [
	"checkout.session.completed",
	"customer.subscription.created",
	"customer.subscription.updated",
	"customer.subscription.deleted",
	"invoice.upcoming",
] as const;
export type HandledEvent = (typeof HANDLED_EVENTS)[number];

export function isHandledEvent(type: string): type is HandledEvent {
	return (HANDLED_EVENTS as readonly string[]).includes(type);
}
