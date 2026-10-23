/**
 * Pro prices and the auto-renewal terms shown next to every checkout button.
 * Client-safe (no server imports). Test prices until research R2 settles them; the
 * amounts Stripe charges come from STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_ANNUAL,
 * so keep these constants in step with those Stripe prices.
 */

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const PRO_PRICES_USD: Readonly<Record<BillingInterval, number>> = {
	month: 15,
	year: 144,
};

/** Where people cancel. Shown in the renewal terms and the reminder email. */
export const CANCEL_PATH = "/settings?tab=billing";
export const TERMS_PLANS_PATH = "/terms#plans";

const INTERVAL_LABEL: Readonly<Record<BillingInterval, string>> = {
	month: "month",
	year: "year",
};

export function isBillingInterval(value: unknown): value is BillingInterval {
	return typeof value === "string" && (BILLING_INTERVALS as readonly string[]).includes(value);
}

/** Whole dollars print without cents ($15), anything else with two decimals. */
export function formatUsd(amount: number): string {
	const whole = Number.isInteger(amount);
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

export function priceLabel(interval: BillingInterval): string {
	return `${formatUsd(PRO_PRICES_USD[interval])}/${INTERVAL_LABEL[interval]}`;
}

/** Percent saved by paying yearly instead of 12 monthly payments, rounded down. */
export function annualSavingsPercent(): number {
	const monthlyYear = PRO_PRICES_USD.month * 12;
	return Math.floor(((monthlyYear - PRO_PRICES_USD.year) / monthlyYear) * 100);
}

/** Yearly price spread over 12 months, for comparison copy. */
export function annualMonthlyEquivalent(): string {
	return formatUsd(Math.round((PRO_PRICES_USD.year / 12) * 100) / 100);
}

/**
 * The auto-renewal disclosure (California ARL, New York GBL 527-a): price, billing
 * period, that it renews until canceled, and how to cancel. Shown right next to the
 * checkout button and repeated on Stripe Checkout.
 */
export function renewalTerms(interval: BillingInterval): string {
	const price = formatUsd(PRO_PRICES_USD[interval]);
	const period = INTERVAL_LABEL[interval];
	const reminder =
		interval === "year" ? " We'll email you a reminder before each yearly renewal." : "";
	return (
		`NextMilestone Pro costs ${price} per ${period}, plus any applicable tax. ` +
		`Your subscription renews automatically every ${period} at the then-current price ` +
		`until you cancel. Cancel any time in Settings → Billing; you keep Pro until the end ` +
		`of the period you've paid for.${reminder}`
	);
}
