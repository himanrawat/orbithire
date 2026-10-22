import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { CtaBand, Eyebrow, TONES, type Tone } from "@/components/marketing/page-kit";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
	COMMUNITY_FAQS,
	FAQS,
	FOCUS_FAQS,
	JOBS_FAQS,
	PREP_FAQS,
	TODAY_FAQS,
	type FaqItem,
} from "@/components/marketing/faq-data";

const PATH = "/faq";

export const metadata: Metadata = pageMetadata(
	PATH,
	"Questions: NextMilestone",
	"Answers about NextMilestone: who it's for, the phone app, AI drafts, privacy, Today, interview prep, focus sessions, jobs, learning and the community.",
);

const GROUPS: { id: string; title: string; tone: Tone; href?: string; items: readonly FaqItem[] }[] = [
	{ id: "start", title: "Getting started", tone: TONES.today, items: FAQS },
	{ id: "today", title: "Today", tone: TONES.today, href: "/product/today", items: TODAY_FAQS },
	{ id: "prep", title: "Interview prep", tone: TONES.prep, href: "/product/interview-prep", items: PREP_FAQS },
	{ id: "focus", title: "Focus", tone: TONES.focus, href: "/product/focus", items: FOCUS_FAQS },
	{ id: "jobs", title: "Jobs and learning", tone: TONES.jobs, href: "/product/jobs-and-learning", items: JOBS_FAQS },
	{ id: "community", title: "Community", tone: TONES.community, href: "/community", items: COMMUNITY_FAQS },
];

const structuredData = {
	"@context": "https://schema.org",
	"@type": "FAQPage",
	mainEntity: GROUPS.flatMap((g) =>
		g.items.map((f) => ({
			"@type": "Question",
			name: f.q,
			acceptedAnswer: { "@type": "Answer", text: f.a },
		})),
	),
};

export default function FaqPage({ searchParams }: { searchParams?: SearchParams }) {
	const redirectQuery = getRedirectQuery(searchParams);
	return (
		<MarketingShell redirectQuery={redirectQuery} structuredData={structuredData}>
			<section aria-labelledby="h1" className="pb-10 pt-10 md:pb-16 md:pt-20">
				<div className="nm-wrap">
					<span className="nm-mono text-xs font-medium text-[var(--ink-muted)]">Questions</span>
					<h1
						id="h1"
						className="nm-display mt-4 max-w-[14ch] text-[44px] leading-[44px] tracking-[-0.03em] md:text-[64px] md:leading-[62px] xl:text-[80px] xl:leading-[76px]"
					>
						Questions, answered. <span className="font-normal text-[var(--ink-muted)]">Plainly.</span>
					</h1>
					<p className="nm-lead mt-6">
						What people ask before they start, grouped by area. Still unsure?{" "}
						<Link href="/contact" className="text-[var(--info)] underline underline-offset-2">
							Write to us
						</Link>{" "}
						and a person will reply.
					</p>
				</div>
			</section>

			<div className="nm-wrap grid gap-10 pb-14 md:pb-[104px] lg:grid-cols-[240px_1fr] lg:gap-16">
				<nav aria-label="Question groups" className="lg:sticky lg:top-24 lg:self-start">
					<ul className="flex flex-wrap gap-2 lg:grid lg:gap-1">
						{GROUPS.map((g) => (
							<li key={g.id}>
								<a
									href={`#${g.id}`}
									className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-3 text-[15px] font-medium text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] max-lg:border max-lg:border-[var(--line)]"
								>
									<i className="h-2 w-2.5 rounded-t-full rounded-b-[1px]" style={{ background: g.tone.fg }} aria-hidden="true" />
									{g.title}
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="grid gap-14">
					{GROUPS.map((g) => (
						<section key={g.id} id={g.id} aria-labelledby={`h-${g.id}`}>
							<div className="mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
								<h2 id={`h-${g.id}`}>
									<Eyebrow tone={g.tone}>{g.title}</Eyebrow>
								</h2>
								{g.href && (
									<Link href={g.href} className="nm-tlink text-sm font-semibold">
										About {g.title.toLowerCase()}
									</Link>
								)}
							</div>
							<Accordion type="single" collapsible className="w-full">
								{g.items.map((item) => (
									<AccordionItem key={item.id} value={item.id} className="border-[var(--line)]">
										<AccordionTrigger className="min-h-[56px] text-left text-[19px] font-semibold leading-[24px] hover:no-underline">
											{item.q}
										</AccordionTrigger>
										<AccordionContent className="max-w-[68ch] text-base leading-6 text-[var(--ink-muted)]">{item.a}</AccordionContent>
									</AccordionItem>
								))}
							</Accordion>
						</section>
					))}
				</div>
			</div>

			<CtaBand
				redirectQuery={redirectQuery}
				title="The rest is easier to show."
				lead="Setup takes about 2 minutes, and every step can be skipped."
			/>
		</MarketingShell>
	);
}
