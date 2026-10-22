// Building blocks for the inner marketing pages, cut from the landing page's own parts: the
// split heading, the numbered rows from Interview prep, the arch markers, the bordered FAQ
// block and the ink card from Focus.

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { Btn } from "./btn";
import type { FaqItem } from "./faq-data";

export type Tone = { fg: string; bg: string };

export const TONES = {
	today: { fg: "var(--cap-ink)", bg: "var(--cap-soft)" },
	prep: { fg: "var(--kind-prep)", bg: "var(--kind-prep-soft)" },
	focus: { fg: "var(--kind-focus)", bg: "var(--kind-focus-soft)" },
	jobs: { fg: "var(--kind-jobs)", bg: "var(--kind-jobs-soft)" },
	learn: { fg: "var(--kind-learn)", bg: "var(--kind-learn-soft)" },
	community: { fg: "var(--success)", bg: "var(--success-soft)" },
} satisfies Record<string, Tone>;

/* the milestone mark: a cap-yellow arch on an ink post */
function Stone({ cap = "var(--cap)" }: { cap?: string }) {
	return (
		<span className="mt-1 grid w-3 flex-none gap-px" aria-hidden="true">
			<span className="nm-arch h-1.5" style={{ background: cap }} />
			<span className="h-3 bg-[var(--ink)]" />
		</span>
	);
}

export function Eyebrow({ tone, children }: { tone: Tone; children: ReactNode }) {
	return (
		<span
			className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-semibold"
			style={{ background: tone.bg, color: tone.fg }}
		>
			<i className="h-2 w-2.5 rounded-t-full rounded-b-[1px]" style={{ background: tone.fg }} aria-hidden="true" />
			{children}
		</span>
	);
}

/* Page heading: the eyebrow, a two-tone headline like the hero's, and a card of the few
   numbers that define the feature. */
export function PageHero({
	tone,
	eyebrow,
	title,
	muted,
	lead,
	facts,
	redirectQuery,
	secondary,
}: {
	tone: Tone;
	eyebrow: string;
	title: string;
	muted?: string;
	lead: string;
	facts: [string, string][];
	redirectQuery: string;
	secondary?: { label: string; href: string };
}) {
	return (
		<section aria-labelledby="h1" className="pb-14 pt-10 md:pb-[88px] md:pt-20">
			<div className="nm-wrap grid items-end gap-12 lg:grid-cols-[7fr_4fr] lg:gap-16">
				<div className="max-w-3xl">
					<Eyebrow tone={tone}>{eyebrow}</Eyebrow>
					<h1
						id="h1"
						className="nm-display mt-6 text-[44px] leading-[44px] tracking-[-0.03em] md:text-[64px] md:leading-[62px] xl:text-[80px] xl:leading-[76px] xl:tracking-[-0.035em]"
					>
						{title}
						{muted && (
							<>
								{" "}
								<span className="font-normal text-[var(--ink-muted)]">{muted}</span>
							</>
						)}
					</h1>
					<p className="mt-6 max-w-[42ch] text-[17px] leading-[26px] text-[var(--ink-muted)] md:text-xl md:leading-[30px]">{lead}</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Btn href={`/signup${redirectQuery}`} arrow className="max-sm:w-full max-sm:justify-center">
							Get started
						</Btn>
						{secondary && (
							<Btn href={secondary.href} variant="secondary" className="max-sm:w-full max-sm:justify-center">
								{secondary.label}
							</Btn>
						)}
					</div>
				</div>

				<dl className="nm-grain grid rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[var(--shadow-lift)] [--grain-o:.25]">
					{facts.map(([value, label]) => (
						<div
							key={label}
							className="relative z-[2] grid grid-cols-[96px_1fr] items-baseline gap-4 border-b border-[var(--line)] px-4 py-4 last:border-b-0"
						>
							<dt className="nm-mono text-[26px] font-semibold leading-8 tracking-[-0.02em]">{value}</dt>
							<dd className="text-[15px] leading-[22px] text-[var(--ink-muted)]">{label}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}

/* The split heading every section on the landing page opens with. */
export function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
	return (
		<div className="mb-12 grid items-end gap-6 md:grid-cols-[6fr_5fr] md:gap-12">
			<h2 id={id} className="nm-h2">
				{title}
			</h2>
			{lead && <p className="nm-lead">{lead}</p>}
		</div>
	);
}

/* Numbered rows between hairlines, as in Interview prep's steps, laid out in columns. */
export function Points({ id, title, lead, items }: { id: string; title: string; lead?: string; items: [string, string][] }) {
	return (
		<section aria-labelledby={id} className="py-14 md:py-[104px]">
			<div className="nm-wrap">
				<SectionHead id={id} title={title} lead={lead} />
				<ol className={cn("grid gap-x-10 md:grid-cols-2", items.length % 3 === 0 && "lg:grid-cols-3")}>
					{items.map(([b, p], i) => (
						<li key={b} className="grid grid-cols-[48px_1fr] gap-4 border-t border-[var(--line)] py-6">
							<span className="nm-mono pt-0.5 text-[13px] font-medium text-[var(--ink-muted)]">{String(i + 1).padStart(2, "0")}</span>
							<div>
								<h3 className="text-[19px] font-semibold leading-[24px] tracking-[-0.01em]">{b}</h3>
								<p className="mt-2 text-[var(--ink-muted)]">{p}</p>
							</div>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}

const STAGES = [
	{ key: "student", label: "Student", color: "var(--stage-student)", years: "studying" },
	{ key: "early", label: "Early career", color: "var(--stage-early)", years: "0–3 years" },
	{ key: "experienced", label: "Experienced", color: "var(--stage-experienced)", years: "3–10 years" },
	{ key: "leader", label: "Leader", color: "var(--stage-leader)", years: "10+ years" },
] as const;

export type StageCopy = Record<(typeof STAGES)[number]["key"], string>;

/* What the feature leads with at each career stage. */
export function StageGrid({ id, title, lead, copy }: { id: string; title: string; lead?: string; copy: StageCopy }) {
	return (
		<section aria-labelledby={id} className="py-14 md:py-[104px]">
			<div className="nm-wrap">
				<SectionHead id={id} title={title} lead={lead} />
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{STAGES.map((s) => (
						<article
							key={s.key}
							className="flex flex-col gap-5 rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
						>
							<span className="grid w-6 gap-[2px]" aria-hidden="true">
								<span className="nm-arch h-3" style={{ background: s.color }} />
								<span className="h-5 bg-[var(--ink)]" />
							</span>
							<div>
								<h3 className="text-[19px] font-semibold leading-6">{s.label}</h3>
								<p className="nm-mono mt-1 text-xs text-[var(--ink-muted)]">{s.years}</p>
							</div>
							<p className="text-[15px] leading-[22px] text-[var(--ink-muted)]">{copy[s.key]}</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}

/* Short notes with the milestone mark, as under the Today frame. */
export function Notes({ items }: { items: [string, string][] }) {
	return (
		<div className="grid gap-6 md:grid-cols-3">
			{items.map(([b, rest]) => (
				<div key={b} className="flex gap-3 text-[15px] leading-[22px]">
					<Stone />
					<span>
						<b className="font-semibold">{b}</b> <span className="text-[var(--ink-muted)]">{rest}</span>
					</span>
				</div>
			))}
		</div>
	);
}

/* The landing page's bordered FAQ block, with this page's questions. */
export function PageFaq({ title = "Questions, answered.", items }: { title?: string; items: readonly FaqItem[] }) {
	return (
		<section aria-labelledby="h-page-faq" className="py-16 md:py-24">
			<div className="nm-wrap">
				<div className="mx-auto grid w-full max-w-5xl grid-cols-1 border-y border-[var(--line)] md:grid-cols-2 md:border-x">
					<div className="flex flex-col gap-4 border-b border-[var(--line)] px-6 pb-6 pt-12 md:border-b-0 md:border-e md:px-10 md:py-16">
						<span className="nm-mono text-xs font-medium text-[var(--ink-muted)]">Questions</span>
						<h2 id="h-page-faq" className="nm-display text-4xl font-[680] leading-[1.04] tracking-[-0.025em] md:text-5xl">
							{title}
						</h2>
						<p className="max-w-sm text-[15px] text-[var(--ink-muted)]">
							More in{" "}
							<Link href="/faq" className="text-[var(--info)] underline underline-offset-2">
								all questions
							</Link>
							, or{" "}
							<Link href="/contact" className="text-[var(--info)] underline underline-offset-2">
								write to us
							</Link>{" "}
							and a person will reply.
						</p>
					</div>
					<div className="flex flex-col justify-center px-6 py-4 md:px-8">
						<Accordion type="single" collapsible className="w-full">
							{items.map((item) => (
								<AccordionItem key={item.id} value={item.id} className="border-[var(--line)]">
									<AccordionTrigger className="min-h-[44px] text-left text-[17px] font-semibold leading-[22px] hover:no-underline">
										{item.q}
									</AccordionTrigger>
									<AccordionContent className="text-[15px] leading-[22px] text-[var(--ink-muted)]">{item.a}</AccordionContent>
								</AccordionItem>
							))}
						</Accordion>
					</div>
				</div>
			</div>
		</section>
	);
}

/* Closing call to action on the ink card. */
export function CtaBand({ redirectQuery, title, lead }: { redirectQuery: string; title: string; lead: string }) {
	return (
		<section aria-labelledby="h-cta" className="py-14 md:py-[104px]">
			<div className="nm-wrap">
				<div className="nm-grain overflow-hidden rounded-[32px] bg-[var(--night)] px-6 py-14 text-center text-[var(--night-ink)] [--grain-o:.5] md:rounded-[40px] md:px-12 md:py-24">
					<div className="relative z-[2]">
						<div className="mx-auto mb-8 grid w-[56px] gap-1.5" aria-hidden="true">
							<div className="nm-arch h-7 bg-[var(--cap)]" />
							<div className="h-12 bg-[var(--night-ink)]" />
						</div>
						<h2 id="h-cta" className="nm-display mx-auto max-w-[18ch] text-[40px] leading-[42px] tracking-[-0.03em] md:text-6xl md:leading-[58px]">
							{title}
						</h2>
						<p className="mx-auto mb-10 mt-6 max-w-xl text-lg leading-relaxed text-[var(--night-muted)]">{lead}</p>
						<Btn href={`/signup${redirectQuery}`} arrow className="justify-center max-sm:w-full">
							Get started
						</Btn>
					</div>
				</div>
			</div>
		</section>
	);
}

export const PAGES = [
	{ href: "/product/today", title: "Today", tone: TONES.today, blurb: "One next step, with the reason, and a plan of 3 to 5 items." },
	{ href: "/product/interview-prep", title: "Interview prep", tone: TONES.prep, blurb: "Questions people really got asked, with AI feedback you review." },
	{ href: "/product/focus", title: "Focus", tone: TONES.focus, blurb: "25, 50 or 90 minutes tied to one task, around your calendar." },
	{ href: "/product/jobs-and-learning", title: "Jobs and learning", tone: TONES.jobs, blurb: "Matches every morning, and the skills they ask for." },
	{ href: "/community", title: "Community", tone: TONES.community, blurb: "Milestones you choose to share, and advice ranked by helpful." },
] as const;

/* Links on to the other pages, leaving out the one you are on. */
export function MorePages({ current }: { current: string }) {
	const pages = PAGES.filter((p) => p.href !== current);
	return (
		<section aria-labelledby="h-more" className="pb-14 pt-6 md:pb-[104px]">
			<div className="nm-wrap">
				<h2 id="h-more" className="nm-display mb-8 text-[32px] leading-[36px] tracking-[-0.025em] md:text-[44px] md:leading-[46px]">
					Keep exploring.
				</h2>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{pages.map((p) => (
						<Link
							key={p.href}
							href={p.href}
							className="group flex min-h-[168px] flex-col rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-5 transition-[border-color,box-shadow] [transition-duration:var(--duration-base)] hover:border-[var(--line-control)] hover:shadow-[var(--shadow-lift)]"
						>
							<i className="h-2.5 w-3 rounded-t-full rounded-b-[1px]" style={{ background: p.tone.fg }} aria-hidden="true" />
							<h3 className="mt-4 text-[19px] font-semibold leading-6">{p.title}</h3>
							<p className="mt-1.5 text-[15px] leading-[22px] text-[var(--ink-muted)]">{p.blurb}</p>
							<span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold">
								Read more
								<ArrowRight size={16} strokeWidth={1.75} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
							</span>
						</Link>
					))}
				</div>
			</div>
		</section>
	);
}
