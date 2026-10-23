import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { Btn } from "@/components/marketing/btn";
import { CtaBand, Eyebrow, MorePages, PageFaq, SectionHead, TONES } from "@/components/marketing/page-kit";
import type { FaqItem } from "@/components/marketing/faq-data";
import { PLAN_LIMITS } from "@/lib/billing/limits";
import {
	PRO_PRICES_USD,
	TERMS_PLANS_PATH,
	annualMonthlyEquivalent,
	annualSavingsPercent,
	formatUsd,
	renewalTerms,
} from "@/lib/billing/prices";

const PATH = "/pricing";

export const metadata: Metadata = pageMetadata(
	PATH,
	"Pricing: Free and Pro | NextMilestone",
	`NextMilestone is free for job tracking, your learning log and the community. Pro is ${formatUsd(PRO_PRICES_USD.month)} a month or ${formatUsd(PRO_PRICES_USD.year)} a year, and you can cancel online any time.`,
);

const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

const FREE_FEATURES = [
	"Today, your daily plan",
	"Unlimited job tracking",
	"Learning log",
	`${PLAN_LIMITS.free.learning_paths} learning path at a time`,
	`${PLAN_LIMITS.free.ai_feedback} AI feedback reviews a month`,
	"Community",
	"Bring your own AI key for unlimited AI feedback",
];

const PRO_FEATURES = [
	"Everything in Free",
	"Unlimited AI feedback",
	"Voice answers",
	"Mock interviews",
	"Every learning path",
	"Calendar sync",
	"Tailored resumes",
];

const PRICING_FAQS: readonly FaqItem[] = [
	{
		id: "renewal",
		q: "Does Pro renew automatically?",
		a: `Yes. Pro renews every month or every year, depending on the plan you pick, at the then-current price until you cancel. We'll show the price and renewal terms next to the button before you pay, and email you before each yearly renewal.`,
	},
	{
		id: "cancel",
		q: "How do I cancel?",
		a: "In Settings → Billing, select Cancel plan and confirm. That's it, no call or chat needed. You keep Pro until the end of the period you've paid for and you won't be charged again.",
	},
	{
		id: "own-key",
		q: "I have my own OpenAI or Anthropic key. Do I need Pro?",
		a: "Not for AI limits. With your own key, AI feedback and tailored resumes are unlimited on Free. Voice answers, mock interviews, every path and calendar sync are still part of Pro.",
	},
	{
		id: "students",
		q: "Is there student pricing?",
		a: "It's coming soon: a lower Pro price for students with a .edu email address. Until then, Free covers job tracking, a learning path and 10 AI reviews a month.",
	},
	{
		id: "price-change",
		q: "Will the price change?",
		a: "These are early prices while we learn what Pro is worth to people. If the price goes up, we'll give you at least 30 days' notice and you can cancel before it applies.",
	},
];

function FeatureList({ items }: Readonly<{ items: readonly string[] }>) {
	return (
		<ul className="mt-6 grid gap-3">
			{items.map((item) => (
				<li key={item} className="flex gap-3 text-[15px] leading-[22px]">
					<Check className="mt-0.5 h-4 w-4 flex-none text-[var(--success)]" aria-hidden="true" />
					<span>{item}</span>
				</li>
			))}
		</ul>
	);
}

/* Signed-out visitors are sent to sign in first, then land on Settings → Billing. */
function ProAction() {
	if (!BILLING_ENABLED) {
		return <p className="nm-mono text-sm font-medium text-[var(--ink-muted)]">Pro is coming soon. Start on Free today.</p>;
	}
	return (
		<Btn href="/settings?tab=billing&interval=year" arrow className="justify-center max-sm:w-full">
			Get Pro
		</Btn>
	);
}

function PlanCards({ redirectQuery }: Readonly<{ redirectQuery: string }>) {
	return (
		<div className="grid gap-5 md:grid-cols-2">
			<article aria-labelledby="h-free" className="flex flex-col rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 md:p-8">
				<h2 id="h-free" className="text-[22px] font-semibold leading-7">Free</h2>
				<p className="mt-4">
					<span className="nm-display text-[44px] leading-[44px] tracking-[-0.03em]">$0</span>
					<span className="text-[var(--ink-muted)]"> forever</span>
				</p>
				<p className="mt-3 text-[15px] text-[var(--ink-muted)]">A daily habit for your career, with no card needed.</p>
				<FeatureList items={FREE_FEATURES} />
				<div className="mt-auto pt-8">
					<Btn href={`/signup${redirectQuery}`} variant="secondary" className="justify-center max-sm:w-full">
						Start free
					</Btn>
				</div>
			</article>

			<article aria-labelledby="h-pro" className="flex flex-col rounded-[20px] border border-[var(--ink)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lift)] md:p-8">
				<div className="flex items-center justify-between gap-3">
					<h2 id="h-pro" className="text-[22px] font-semibold leading-7">Pro</h2>
					<Eyebrow tone={TONES.today}>Save {annualSavingsPercent()}% yearly</Eyebrow>
				</div>
				<p className="mt-4">
					<span className="nm-display text-[44px] leading-[44px] tracking-[-0.03em]">{formatUsd(PRO_PRICES_USD.month)}</span>
					<span className="text-[var(--ink-muted)]"> a month</span>
				</p>
				<p className="mt-3 text-[15px] text-[var(--ink-muted)]">
					or {formatUsd(PRO_PRICES_USD.year)} a year (about {annualMonthlyEquivalent()} a month). For when you&apos;re
					preparing for interviews in earnest.
				</p>
				<FeatureList items={PRO_FEATURES} />
				<div className="mt-auto space-y-3 pt-8">
					<ProAction />
					<p className="text-[13px] leading-5 text-[var(--ink-muted)]">
						Renews automatically until you cancel. Cancel online in Settings → Billing.{" "}
						<Link href={TERMS_PLANS_PATH} className="text-[var(--info)] underline underline-offset-2">
							Renewal terms
						</Link>
					</p>
				</div>
			</article>
		</div>
	);
}

function RenewalSection() {
	return (
		<section aria-labelledby="h-renewal" className="py-14 md:py-[104px]">
			<div className="nm-wrap">
				<SectionHead
					id="h-renewal"
					title="Plain renewal terms."
					lead="What you agree to when you choose Pro, in full. You'll see the same words next to the button before you pay."
				/>
				<div className="grid gap-5 md:grid-cols-2">
					<p className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 text-[15px] leading-[22px]">
						<b className="font-semibold">Monthly.</b> {renewalTerms("month")}
					</p>
					<p className="rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 text-[15px] leading-[22px]">
						<b className="font-semibold">Yearly.</b> {renewalTerms("year")}
					</p>
				</div>
				<p className="mt-6 text-[15px] text-[var(--ink-muted)]">
					Prices are in US dollars. Read the{" "}
					<Link href={TERMS_PLANS_PATH} className="text-[var(--info)] underline underline-offset-2">
						paid plans section of our Terms
					</Link>
					. Student pricing for .edu addresses is coming soon.
				</p>
			</div>
		</section>
	);
}

export default function PricingPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	const redirectQuery = getRedirectQuery(searchParams);
	return (
		<MarketingShell redirectQuery={redirectQuery}>
			<section aria-labelledby="h1" className="pb-10 pt-10 md:pb-16 md:pt-20">
				<div className="nm-wrap">
					<span className="nm-mono text-xs font-medium text-[var(--ink-muted)]">Pricing</span>
					<h1
						id="h1"
						className="nm-display mt-4 max-w-[16ch] text-[44px] leading-[44px] tracking-[-0.03em] md:text-[64px] md:leading-[62px] xl:text-[80px] xl:leading-[76px]"
					>
						Free to start. <span className="font-normal text-[var(--ink-muted)]">Pro when you need it.</span>
					</h1>
					<p className="nm-lead mt-6">
						Job tracking, your learning log and the community stay free. Pro adds unlimited AI feedback and the
						interview practice tools. Cancel online any time, as easily as you signed up.
					</p>
				</div>
			</section>
			<section aria-label="Plans" className="pb-6">
				<div className="nm-wrap">
					<PlanCards redirectQuery={redirectQuery} />
				</div>
			</section>
			<RenewalSection />
			<PageFaq title="Pricing questions." items={PRICING_FAQS} />
			<CtaBand
				redirectQuery={redirectQuery}
				title="Start free today."
				lead="No card needed. Upgrade from Settings whenever Pro is worth it to you."
			/>
			<MorePages current={PATH} />
		</MarketingShell>
	);
}
