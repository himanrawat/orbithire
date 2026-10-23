import "server-only";

import Stripe from "stripe";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/config";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { CANCEL_PATH, type BillingInterval } from "./prices";
import { isBillingEnabled, normalizeSubscriptionRow, type SubscriptionRow } from "./plan";
import { subscriptionToSync, type StripeSubscriptionLike } from "./stripeSync";

let stripeClient: Stripe | null = null;

/** The Stripe client, or null when billing is not configured. */
export function getStripe(): Stripe | null {
	if (!isBillingEnabled()) return null;
	stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY as string, {
		appInfo: { name: "NextMilestone" },
	});
	return stripeClient;
}

export function priceIdFor(interval: BillingInterval): string {
	const id = interval === "year" ? process.env.STRIPE_PRICE_PRO_ANNUAL : process.env.STRIPE_PRICE_PRO_MONTHLY;
	return id ?? "";
}

export function billingReturnUrl(query = ""): string {
	return `${serverEnv.siteUrl.replace(/\/$/, "")}${CANCEL_PATH}${query}`;
}

export function billingDisabledResponse() {
	return NextResponse.json({ error: "Billing isn't available on this site." }, { status: 404 });
}

export type AuthedUser = Readonly<{ user: User; supabase: SupabaseClient }>;

/** The signed-in user, or a 401 response. */
export async function requireBillingUser(): Promise<AuthedUser | NextResponse> {
	const supabase = createServerSupabase();
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	return { user, supabase };
}

export async function getSubscriptionRow(userId: string, client?: SupabaseClient): Promise<SubscriptionRow | null> {
	const supabase = client ?? createServiceSupabase();
	const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
	if (error) throw new Error(`subscriptions lookup failed: ${error.message}`);
	return normalizeSubscriptionRow(data as Record<string, unknown> | null);
}

export async function findUserIdByStripe(
	column: "stripe_customer_id" | "stripe_subscription_id",
	value: string | null
): Promise<string | null> {
	if (!value) return null;
	const { data, error } = await createServiceSupabase()
		.from("subscriptions")
		.select("user_id")
		.eq(column, value)
		.maybeSingle();
	if (error) throw new Error(`subscriptions lookup failed: ${error.message}`);
	return (data as { user_id?: string } | null)?.user_id ?? null;
}

export async function upsertSubscription(userId: string, fields: Record<string, unknown>): Promise<SubscriptionRow | null> {
	const { data, error } = await createServiceSupabase()
		.from("subscriptions")
		.upsert({ user_id: userId, ...fields }, { onConflict: "user_id" })
		.select("*")
		.maybeSingle();
	if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
	return normalizeSubscriptionRow(data as Record<string, unknown> | null);
}

/** Mirror a Stripe subscription into the user's row. */
export async function syncSubscription(
	userId: string,
	subscription: StripeSubscriptionLike,
	extra: Record<string, unknown> = {},
	deleted = false
): Promise<SubscriptionRow | null> {
	return upsertSubscription(userId, { ...subscriptionToSync(subscription, deleted), ...extra });
}

/** The user's Stripe customer id, creating the customer on first checkout. */
export async function ensureStripeCustomer(stripe: Stripe, user: User, row: SubscriptionRow | null): Promise<string> {
	if (row?.stripe_customer_id) return row.stripe_customer_id;
	const customer = await stripe.customers.create(
		{ email: user.email ?? undefined, metadata: { user_id: user.id } },
		{ idempotencyKey: `customer-${user.id}` }
	);
	return customer.id;
}

/**
 * Account deletion: end any paid subscription right away so a deleted account is never
 * billed again. Returns false when Stripe could not be reached.
 */
export async function cancelSubscriptionForDeletedAccount(userId: string): Promise<boolean> {
	const stripe = getStripe();
	if (!stripe) return true;
	const row = await getSubscriptionRow(userId).catch(() => null);
	if (!row?.stripe_subscription_id || row.status === "canceled") return true;
	try {
		await stripe.subscriptions.cancel(row.stripe_subscription_id);
		return true;
	} catch (error) {
		if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") return true;
		console.error("[billing] cancel on account delete failed:", error);
		return false;
	}
}
