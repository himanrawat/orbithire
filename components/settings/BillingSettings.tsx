"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, CreditCard, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS, type PlanContext } from "@/lib/billing/limits";
import {
	BILLING_INTERVALS,
	TERMS_PLANS_PATH,
	annualSavingsPercent,
	isBillingInterval,
	priceLabel,
	renewalTerms,
	type BillingInterval,
} from "@/lib/billing/prices";

type StatusState =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; plan: PlanContext };

type ActionResult = { url?: string; error?: string };

const NETWORK_ERROR = "We couldn't reach the server. Check your connection and try again.";

async function postBilling(path: string, body: Record<string, unknown> = {}): Promise<ActionResult> {
	try {
		const response = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = (await response.json().catch(() => ({}))) as ActionResult;
		if (response.ok) return data;
		return { error: data.error ?? "Something went wrong. Please try again." };
	} catch {
		return { error: NETWORK_ERROR };
	}
}

async function fetchPlan(): Promise<StatusState> {
	try {
		const response = await fetch("/api/billing/status", { cache: "no-store" });
		if (!response.ok) return { status: "error", message: "We couldn't load your plan." };
		const data = (await response.json()) as { plan: PlanContext };
		return { status: "ready", plan: data.plan };
	} catch {
		return { status: "error", message: NETWORK_ERROR };
	}
}

function formatLongDate(iso: string | null): string | null {
	if (!iso) return null;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function readQuery(): { interval: BillingInterval; checkout: string | null } {
	const params = new URLSearchParams(window.location.search);
	const interval = params.get("interval");
	return { interval: isBillingInterval(interval) ? interval : "year", checkout: params.get("checkout") };
}

function checkoutNotice(checkout: string | null): string | null {
	if (checkout === "success") return "Thanks! Your payment went through. Pro turns on as soon as Stripe confirms it.";
	if (checkout === "canceled") return "Checkout was canceled. You haven't been charged.";
	return null;
}

function useBillingStatus() {
	const [state, setState] = useState<StatusState>({ status: "loading" });
	const reload = useCallback(async () => {
		setState(await fetchPlan());
	}, []);
	useEffect(() => {
		void reload();
	}, [reload]);
	return { state, reload };
}

const FREE_SUMMARY = `Unlimited job tracking, learning log and community, ${PLAN_LIMITS.free.learning_paths} learning path and ${PLAN_LIMITS.free.ai_feedback} AI feedback reviews a month.`;
const PRO_SUMMARY =
	"Unlimited AI feedback, voice answers, mock interviews, every path, calendar sync and tailored resumes.";

function planDetail(plan: PlanContext): string {
	const date = formatLongDate(plan.currentPeriodEnd);
	if (plan.plan !== "pro") return FREE_SUMMARY;
	if (!date) return PRO_SUMMARY;
	if (plan.cancelAtPeriodEnd) return `Canceled. You keep Pro until ${date}, then move to Free. You won't be charged again.`;
	return `Renews on ${date} (${priceLabel(plan.interval ?? "month")}).`;
}

function CurrentPlanCard({ plan }: Readonly<{ plan: PlanContext }>) {
	const isPro = plan.plan === "pro";
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Zap className="h-5 w-5" aria-hidden="true" />
					Current plan
				</CardTitle>
				<CardDescription>Your plan and what it includes.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="rounded-lg border p-4">
					<p className="text-lg font-semibold">{isPro ? "Pro" : "Free"}</p>
					<p className="text-sm text-muted-foreground">{planDetail(plan)}</p>
					{plan.status === "past_due" && (
						<p className="mt-2 text-sm text-destructive">
							Your last payment didn&apos;t go through. Update your card in Manage payment to keep Pro.
						</p>
					)}
				</div>
				{plan.hasOwnAiKey && !isPro && (
					<p className="text-sm text-muted-foreground">
						You use your own AI key, so AI feedback and tailored resumes are unlimited on Free.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function IntervalPicker({
	value,
	onChange,
}: Readonly<{ value: BillingInterval; onChange: (interval: BillingInterval) => void }>) {
	return (
		<fieldset className="grid gap-3 sm:grid-cols-2">
			<legend className="mb-2 text-sm font-medium">Billing period</legend>
			{BILLING_INTERVALS.map((interval) => (
				<label
					key={interval}
					className={cn(
						"flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
						value === interval && "border-primary bg-muted"
					)}
				>
					<input
						type="radio"
						name="billing-interval"
						value={interval}
						checked={value === interval}
						onChange={() => onChange(interval)}
					/>
					<span>
						<span className="font-medium">{interval === "year" ? "Yearly" : "Monthly"}</span>{" "}
						<span className="text-muted-foreground">{priceLabel(interval)}</span>
						{interval === "year" && (
							<span className="ml-1 text-muted-foreground">(save {annualSavingsPercent()}%)</span>
						)}
					</span>
				</label>
			))}
		</fieldset>
	);
}

function UpgradeCard({ initialInterval }: Readonly<{ initialInterval: BillingInterval }>) {
	const consentId = useId();
	const termsId = useId();
	const [interval, setBillingInterval] = useState<BillingInterval>(initialInterval);
	const [accepted, setAccepted] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const startCheckout = async () => {
		setBusy(true);
		setError(null);
		const result = await postBilling("/api/billing/checkout", { interval, acceptRenewalTerms: true });
		if (result.url) {
			window.location.assign(result.url);
			return;
		}
		setError(result.error ?? "We couldn't start checkout.");
		setBusy(false);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Upgrade to Pro</CardTitle>
				<CardDescription>{PRO_SUMMARY}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<IntervalPicker value={interval} onChange={setBillingInterval} />
				<div className="space-y-3 rounded-lg border p-4">
					<p id={termsId} className="text-sm text-muted-foreground">
						{renewalTerms(interval)}{" "}
						<Link href={TERMS_PLANS_PATH} className="underline underline-offset-2">
							Full terms
						</Link>
					</p>
					<div className="flex items-start gap-2 text-sm">
						<input
							id={consentId}
							type="checkbox"
							className="mt-0.5"
							checked={accepted}
							onChange={(event) => setAccepted(event.target.checked)}
							aria-describedby={termsId}
						/>
						<label htmlFor={consentId}>
							I agree that Pro renews automatically at {priceLabel(interval)} until I cancel.
						</label>
					</div>
					<Button type="button" disabled={!accepted || busy} onClick={() => void startCheckout()}>
						{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
						Continue to payment
					</Button>
				</div>
				{error && <ErrorLine message={error} />}
			</CardContent>
		</Card>
	);
}

function ErrorLine({ message }: Readonly<{ message: string }>) {
	return (
		<output className="flex items-center gap-2 text-sm text-destructive">
			<AlertCircle className="h-4 w-4" aria-hidden="true" />
			{message}
		</output>
	);
}

function CancelControls({ plan, onChanged }: Readonly<{ plan: PlanContext; onChanged: () => Promise<void> }>) {
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const endDate = formatLongDate(plan.currentPeriodEnd) ?? "the end of your billing period";

	const submit = async (resume: boolean) => {
		setBusy(true);
		setError(null);
		const result = await postBilling("/api/billing/cancel", resume ? { resume: true } : {});
		setBusy(false);
		if (result.error) {
			setError(result.error);
			return;
		}
		setConfirming(false);
		await onChanged();
	};

	if (plan.cancelAtPeriodEnd) {
		return (
			<div className="space-y-2">
				<Button type="button" variant="outline" disabled={busy} onClick={() => void submit(true)}>
					Keep Pro (undo cancel)
				</Button>
				{error && <ErrorLine message={error} />}
			</div>
		);
	}
	if (!confirming) {
		return (
			<Button type="button" variant="outline" onClick={() => setConfirming(true)}>
				Cancel plan
			</Button>
		);
	}
	return (
		<div className="space-y-3 rounded-lg border p-4" role="group" aria-label="Confirm cancellation">
			<p className="text-sm">
				Cancel Pro? You keep Pro until {endDate} and won&apos;t be charged again.
			</p>
			<div className="flex flex-wrap gap-2">
				<Button type="button" variant="destructive" disabled={busy} onClick={() => void submit(false)}>
					{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
					Yes, cancel Pro
				</Button>
				<Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
					Keep Pro
				</Button>
			</div>
			{error && <ErrorLine message={error} />}
		</div>
	);
}

function ManageCard({ plan, onChanged }: Readonly<{ plan: PlanContext; onChanged: () => Promise<void> }>) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const openPortal = async () => {
		setBusy(true);
		setError(null);
		const result = await postBilling("/api/billing/portal");
		if (result.url) {
			window.location.assign(result.url);
			return;
		}
		setError(result.error ?? "We couldn't open the billing portal.");
		setBusy(false);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<CreditCard className="h-5 w-5" aria-hidden="true" />
					Payment and plan
				</CardTitle>
				<CardDescription>Update your card, see invoices, or cancel. Canceling takes one click here.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap items-start gap-3">
				<Button type="button" disabled={busy} onClick={() => void openPortal()}>
					{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
					Manage payment
				</Button>
				{plan.plan === "pro" && <CancelControls plan={plan} onChanged={onChanged} />}
				{error && <ErrorLine message={error} />}
			</CardContent>
		</Card>
	);
}

function BillingOff() {
	return (
		<p className="text-sm text-muted-foreground">
			Paid plans aren&apos;t available here yet, so everything runs on the Free plan.{" "}
			<Link href="/pricing" className="underline underline-offset-2">
				See pricing
			</Link>
		</p>
	);
}

function BillingBody({ plan, reload }: Readonly<{ plan: PlanContext; reload: () => Promise<void> }>) {
	const [query] = useState(readQuery);
	const notice = checkoutNotice(query.checkout);
	const hasBillingAccount = plan.status !== "none";
	return (
		<div className="grid gap-6">
			{notice && <output className="text-sm">{notice}</output>}
			<CurrentPlanCard plan={plan} />
			{!plan.billingEnabled && <BillingOff />}
			{plan.billingEnabled && plan.plan === "free" && <UpgradeCard initialInterval={query.interval} />}
			{plan.billingEnabled && (plan.plan === "pro" || hasBillingAccount) && (
				<ManageCard plan={plan} onChanged={reload} />
			)}
		</div>
	);
}

/** Settings → Billing: current plan, renewal date, upgrade, cancel and payment details. */
export function BillingSettings() {
	const { state, reload } = useBillingStatus();
	if (state.status === "loading") {
		return (
			<output className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Loading your plan…
			</output>
		);
	}
	if (state.status === "error") return <ErrorLine message={state.message} />;
	return <BillingBody plan={state.plan} reload={reload} />;
}
