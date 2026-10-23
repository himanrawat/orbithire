import { afterEach, describe, expect, it, vi } from "vitest";
import {
	FEATURES,
	PLAN_LIMITS,
	buildPlanContext,
	canUse,
	effectivePlan,
	isBillingEnabled,
	limitFor,
	normalizeSubscriptionRow,
	remainingFor,
	resolvePlan,
	type SubscriptionRow,
} from "@/lib/billing/plan";
import {
	PRO_PRICES_USD,
	annualMonthlyEquivalent,
	annualSavingsPercent,
	formatUsd,
	isBillingInterval,
	priceLabel,
	renewalTerms,
} from "@/lib/billing/prices";
import {
	buildRenewalReminder,
	invoiceSubscriptionId,
	isHandledEvent,
	subscriptionToSync,
	unixToIso,
} from "@/lib/billing/stripeSync";
import { cancelSchema, checkoutSchema } from "@/lib/billing/schemas";

const NOW = new Date("2026-10-23T12:00:00Z");
const FUTURE = "2026-11-23T12:00:00.000Z";

function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
	return {
		user_id: "u1",
		stripe_customer_id: "cus_1",
		stripe_subscription_id: "sub_1",
		plan: "pro",
		status: "active",
		interval: "month",
		current_period_end: FUTURE,
		cancel_at_period_end: false,
		renewal_terms_accepted_at: "2026-10-01T00:00:00.000Z",
		updated_at: "2026-10-01T00:00:00.000Z",
		...overrides,
	};
}

describe("resolvePlan", () => {
	it("is free when billing is off, whatever the row says", () => {
		expect(resolvePlan(row(), false, NOW)).toBe("free");
	});

	it("is pro for active, trialing and past_due", () => {
		for (const status of ["active", "trialing", "past_due"] as const) {
			expect(resolvePlan(row({ status }), true, NOW)).toBe("pro");
		}
	});

	it("is free for ended or unpaid subscriptions", () => {
		for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "none"] as const) {
			expect(resolvePlan(row({ status }), true, NOW)).toBe("free");
		}
		expect(resolvePlan(null, true, NOW)).toBe("free");
		expect(resolvePlan(row({ plan: "free" }), true, NOW)).toBe("free");
	});

	it("keeps a day of grace after the period ends, then drops to free", () => {
		expect(resolvePlan(row({ current_period_end: "2026-10-23T00:00:00Z" }), true, NOW)).toBe("pro");
		expect(resolvePlan(row({ current_period_end: "2026-10-21T00:00:00Z" }), true, NOW)).toBe("free");
	});
});

describe("limits and canUse", () => {
	const free = { plan: "free" as const, hasOwnAiKey: false, billingEnabled: true };
	const freeOwnKey = { plan: "free" as const, hasOwnAiKey: true, billingEnabled: true };
	const pro = { plan: "pro" as const, hasOwnAiKey: false, billingEnabled: true };

	it("matches the PRD table", () => {
		expect(PLAN_LIMITS.free.learning_paths).toBe(1);
		expect(PLAN_LIMITS.free.ai_feedback).toBe(10);
		expect(PLAN_LIMITS.free.job_tracking).toBeNull();
		expect(Object.values(PLAN_LIMITS.pro).every((limit) => limit === null)).toBe(true);
	});

	it("caps AI feedback at 10 a month on Free", () => {
		expect(canUse(free, "ai_feedback", 9)).toBe(true);
		expect(canUse(free, "ai_feedback", 10)).toBe(false);
		expect(remainingFor(free, "ai_feedback", 4)).toBe(6);
		expect(remainingFor(free, "ai_feedback", 40)).toBe(0);
	});

	it("gives own-key users unlimited AI on Free, but not Pro-only features", () => {
		expect(limitFor(freeOwnKey, "ai_feedback")).toBeNull();
		expect(canUse(freeOwnKey, "ai_feedback", 500)).toBe(true);
		expect(canUse(freeOwnKey, "mock_interviews")).toBe(false);
		expect(canUse(freeOwnKey, "learning_paths", 1)).toBe(false);
	});

	it("keeps Pro-only features off Free and on for Pro", () => {
		for (const feature of ["voice_answers", "mock_interviews", "calendar_sync"] as const) {
			expect(canUse(free, feature)).toBe(false);
			expect(canUse(pro, feature)).toBe(true);
		}
		expect(canUse(pro, "ai_feedback", 10_000)).toBe(true);
		expect(canUse(free, "learning_paths", 0)).toBe(true);
		expect(canUse(free, "learning_paths", 1)).toBe(false);
	});
});

describe("billing off (no Stripe)", () => {
	const off = { plan: "free" as const, hasOwnAiKey: false, billingEnabled: false };

	it("reports Free but applies Pro rules, so nothing that works today is gated", () => {
		expect(buildPlanContext(null, { billingEnabled: false, hasOwnAiKey: false, now: NOW }).plan).toBe("free");
		expect(effectivePlan(off)).toBe("pro");
		expect(effectivePlan({ plan: "free", billingEnabled: true })).toBe("free");
		for (const feature of FEATURES) {
			expect(limitFor(off, feature)).toBeNull();
			expect(canUse(off, feature, 10_000)).toBe(true);
		}
		expect(remainingFor(off, "ai_feedback", 50)).toBeNull();
	});
});

describe("buildPlanContext / normalizeSubscriptionRow", () => {
	it("defaults a missing row to Free with no status", () => {
		const ctx = buildPlanContext(null, { billingEnabled: true, hasOwnAiKey: false, now: NOW });
		expect(ctx).toMatchObject({ plan: "free", status: "none", interval: null, cancelAtPeriodEnd: false });
	});

	it("drops unknown values from the database row", () => {
		const normalized = normalizeSubscriptionRow({ user_id: "u1", plan: "gold", status: "weird", interval: "week" });
		expect(normalized).toMatchObject({ plan: "free", status: "none", interval: null, cancel_at_period_end: false });
		expect(normalizeSubscriptionRow(null)).toBeNull();
		expect(normalizeSubscriptionRow({})).toBeNull();
	});
});

describe("isBillingEnabled", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("needs the flag and all Stripe keys", () => {
		vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "true");
		vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");
		vi.stubEnv("STRIPE_PRICE_PRO_MONTHLY", "price_m");
		vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "");
		expect(isBillingEnabled()).toBe(false);
		vi.stubEnv("STRIPE_PRICE_PRO_ANNUAL", "price_y");
		expect(isBillingEnabled()).toBe(true);
		vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "false");
		expect(isBillingEnabled()).toBe(false);
	});
});

describe("prices and renewal terms", () => {
	it("uses the test prices", () => {
		expect(PRO_PRICES_USD).toEqual({ month: 15, year: 144 });
		expect(priceLabel("month")).toBe("$15/month");
		expect(priceLabel("year")).toBe("$144/year");
		expect(annualSavingsPercent()).toBe(20);
		expect(annualMonthlyEquivalent()).toBe("$12");
		expect(formatUsd(12.5)).toBe("$12.50");
	});

	it("states price, period, renewal until canceled and how to cancel", () => {
		for (const interval of ["month", "year"] as const) {
			const terms = renewalTerms(interval);
			expect(terms).toContain(formatUsd(PRO_PRICES_USD[interval]));
			expect(terms).toContain(`every ${interval}`);
			expect(terms).toContain("until you cancel");
			expect(terms).toContain("Settings → Billing");
		}
		expect(renewalTerms("year")).toContain("reminder");
		expect(renewalTerms("month")).not.toContain("reminder");
	});

	it("validates intervals", () => {
		expect(isBillingInterval("year")).toBe(true);
		expect(isBillingInterval("week")).toBe(false);
	});
});

describe("request schemas", () => {
	it("requires the renewal consent box", () => {
		expect(checkoutSchema.safeParse({ interval: "year", acceptRenewalTerms: true }).success).toBe(true);
		expect(checkoutSchema.safeParse({ interval: "year", acceptRenewalTerms: false }).success).toBe(false);
		expect(checkoutSchema.safeParse({ interval: "year" }).success).toBe(false);
		expect(checkoutSchema.safeParse({ interval: "week", acceptRenewalTerms: true }).success).toBe(false);
		expect(checkoutSchema.safeParse({ interval: "year", acceptRenewalTerms: true, extra: 1 }).success).toBe(false);
	});

	it("accepts an empty cancel or a resume", () => {
		expect(cancelSchema.safeParse({}).success).toBe(true);
		expect(cancelSchema.safeParse({ resume: true }).success).toBe(true);
		expect(cancelSchema.safeParse({ resume: "yes" }).success).toBe(false);
	});
});

describe("Stripe mapping", () => {
	const periodEnd = Math.floor(Date.parse(FUTURE) / 1000);
	const subscription = {
		id: "sub_1",
		customer: { id: "cus_1" },
		status: "active",
		cancel_at_period_end: false,
		cancel_at: null,
		items: { data: [{ current_period_end: periodEnd, price: { id: "price_y", recurring: { interval: "year" } } }] },
	};

	it("maps an active subscription, reading the period from its items", () => {
		expect(subscriptionToSync(subscription)).toEqual({
			stripe_subscription_id: "sub_1",
			stripe_customer_id: "cus_1",
			plan: "pro",
			status: "active",
			interval: "year",
			current_period_end: FUTURE,
			cancel_at_period_end: false,
		});
	});

	it("falls back to the legacy top-level period end", () => {
		const legacy = { ...subscription, items: { data: [] }, current_period_end: periodEnd };
		expect(subscriptionToSync(legacy).current_period_end).toBe(FUTURE);
	});

	it("treats deleted and expired subscriptions as Free", () => {
		expect(subscriptionToSync(subscription, true)).toMatchObject({ plan: "free", status: "canceled" });
		expect(subscriptionToSync({ ...subscription, status: "incomplete_expired" }).plan).toBe("free");
	});

	it("counts a scheduled cancel_at as not renewing", () => {
		expect(subscriptionToSync({ ...subscription, cancel_at: periodEnd }).cancel_at_period_end).toBe(true);
	});

	it("finds the invoice's subscription in either API shape", () => {
		const base = { customer: "cus_1", amount_due: 14400, currency: "usd" };
		expect(invoiceSubscriptionId({ ...base, parent: { subscription_details: { subscription: "sub_1" } } })).toBe("sub_1");
		expect(invoiceSubscriptionId({ ...base, subscription: "sub_2" })).toBe("sub_2");
		expect(invoiceSubscriptionId(base)).toBeNull();
	});

	it("builds a reminder for yearly plans only", () => {
		const invoice = { customer: "cus_1", amount_due: 14400, currency: "USD", next_payment_attempt: periodEnd };
		const yearly = { user_id: "u1", interval: "year" as const, cancel_at_period_end: false };
		expect(buildRenewalReminder(invoice, yearly, "evt_1")).toEqual({
			user_id: "u1",
			amount_cents: 14400,
			currency: "usd",
			renewal_date: FUTURE,
			interval: "year",
			event_id: "evt_1",
		});
		expect(buildRenewalReminder(invoice, { ...yearly, interval: "month" }, "evt_1")).toBeNull();
		expect(buildRenewalReminder(invoice, { ...yearly, cancel_at_period_end: true }, "evt_1")).toBeNull();
		expect(buildRenewalReminder({ ...invoice, next_payment_attempt: null }, yearly, "evt_1")).toBeNull();
	});

	it("knows which events it handles", () => {
		expect(isHandledEvent("invoice.upcoming")).toBe(true);
		expect(isHandledEvent("charge.succeeded")).toBe(false);
		expect(unixToIso(undefined)).toBeNull();
	});
});
