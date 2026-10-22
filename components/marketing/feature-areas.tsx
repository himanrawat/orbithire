// Feature bento adapted from 21st.dev uiable/block-feature: the same card primitive and
// 3 + 3 grid (wide middle card on top), each card drawn from the product instead of logos.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Card({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
	return (
		<article
			className={cn(
				"relative flex min-h-[288px] flex-col overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
				className,
			)}
		>
			{children}
		</article>
	);
}

function Title({ children, fact }: Readonly<{ children: ReactNode; fact: string }>) {
	return (
		<div className="px-6 text-center">
			<h3 className="text-[20px] font-semibold leading-[26px] tracking-[-0.01em]">{children}</h3>
			<p className="nm-mono mt-1 text-xs text-[var(--ink-muted)]">{fact}</p>
		</div>
	);
}

/* Learn: the skills grid, with the one skill your best matches ask for picked out. */
export function SkillGrid() {
	const skills = ["HTML", "CSS", "React", "Testing", "Caching", "Queues", "A11y", "Next.js", "GraphQL", "SQL", "Git", "CI"];
	const next = 4;
	return (
		<div className="relative flex-1">
			<div className="absolute inset-0 flex items-center justify-center overflow-hidden">
				<div className="grid grid-cols-4 [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_40%,transparent_90%)]">
					{skills.map((s, i) => (
						<div
							key={s}
							className={cn(
								"flex h-[56px] w-[76px] items-center justify-center border border-[var(--line)] text-[13px] font-medium",
								i < 4 ? "text-[var(--ink)]" : "text-[var(--ink-faint)]",
								i === next && "bg-[var(--kind-learn-soft)] font-semibold text-[var(--kind-learn)]",
							)}
						>
							{s}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/* Jobs: the morning's matches, scored against the profile. */
export function MatchList() {
	const rows = [
		{ s: 92, r: "Frontend engineer II", c: "Kestrel Pay · Austin, TX", p: "$165–190k" },
		{ s: 86, r: "Senior UI engineer", c: "Harbor Labs · Remote, US", p: "$150–175k" },
		{ s: 81, r: "Web platform engineer", c: "Tidewater Health · Boston, MA", p: "$135–155k" },
	];
	return (
		<div className="flex flex-1 flex-col justify-center gap-2 px-6 pb-6 pt-7">
			<div className="flex items-baseline justify-between">
				<p className="text-[13px] font-semibold text-[var(--ink-muted)]">New this morning · 7:00 AM</p>
				<p className="nm-mono text-xs text-[var(--ink-muted)]">the best 3 of 24</p>
			</div>
			{rows.map((x, i) => (
				<div
					key={x.r}
					className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] p-2.5"
					style={{ opacity: 1 - i * 0.16 }}
				>
					<span
						className={cn(
							"nm-mono grid size-10 flex-none place-items-center rounded-[var(--radius-sm)] text-sm font-semibold",
							x.s >= 85 ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-sunken)]",
						)}
					>
						{x.s}
					</span>
					<span className="min-w-0 flex-1 text-[15px] font-medium leading-5">
						{x.r}
						<small className="block truncate text-[13px] font-normal text-[var(--ink-muted)]">{x.c}</small>
					</span>
					<span className="nm-mono hidden text-[13px] text-[var(--ink-muted)] sm:block">{x.p}</span>
				</div>
			))}
		</div>
	);
}

/* Interview prep: the question card with its source, and AI feedback in draft dashes. */
function PrepCard() {
	return (
		<div className="relative flex-1">
			<div className="absolute inset-x-5 top-6 grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
				<div className="flex flex-wrap gap-1.5">
					<span className="rounded-full bg-[var(--kind-prep-soft)] px-2 py-0.5 text-xs font-medium text-[var(--kind-prep)]">
						System design
					</span>
					<span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-xs font-medium">Reported by 38 people</span>
				</div>
				<p className="text-[15px] font-semibold leading-5">Design a URL shortener that handles 10,000 writes a second.</p>
				<div className="rounded-[var(--radius-sm)] border-[1.5px] border-dashed border-[var(--draft-line)] bg-[var(--draft-soft)] p-3 text-[13px] leading-[18px]">
					<p className="font-semibold">AI draft · feedback</p>
					<p className="mt-1 text-[var(--ink-muted)]">
						<b className="text-[var(--ink)]">Gap:</b> you didn&apos;t say how cached links are invalidated.
					</p>
				</div>
			</div>
		</div>
	);
}

/* Focus and schedule: a week of blocks around the calendar, in the kind colours. */
export function WeekView() {
	const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
	const blocks: [number, number, number, string, string][] = [
		[0, 0, 2, "focus", "Focus"],
		[1, 1, 1, "learn", "Lesson"],
		[2, 0, 2, "focus", "Focus"],
		[2, 3, 1, "jobs", "Apply"],
		[3, 1, 2, "prep", "Mock"],
		[4, 0, 1, "interview", "Round 2"],
		[4, 2, 2, "focus", "Focus"],
	];
	return (
		<div className="flex flex-1 items-end px-5 pb-0 pt-5">
			<div className="w-full overflow-hidden rounded-t-2xl border border-b-0 border-[var(--line)] bg-[var(--paper)]">
				<div className="grid grid-cols-5 border-b border-[var(--line)] text-center text-xs font-medium text-[var(--ink-muted)]">
					{days.map((d) => (
						<span key={d} className="py-2">
							{d}
						</span>
					))}
				</div>
				<div className="relative grid h-[148px] grid-cols-5 grid-rows-4 gap-1 p-1.5">
					{blocks.map(([d, r, h, k, l], i) => (
						<div
							key={i}
							className="rounded-[6px] border-l-[3px] px-1.5 py-1 text-[11px] font-semibold leading-[14px]"
							style={{
								gridColumn: d + 1,
								gridRow: `${r + 1} / span ${h}`,
								borderColor: `var(--kind-${k})`,
								background: `var(--kind-${k}-soft)`,
								color: `var(--kind-${k})`,
							}}
						>
							{l}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/* Profile and milestones: arch markers ride the road, as the logos ride the belt in the original. */
const ROAD = "M-40 172C20 172 55 112 185.5 112C316 112 351 172 411 172";
const RIDE = 22;
const STONES = ["var(--ink)", "var(--stage-student)", "var(--ink)", "var(--stage-early)", "var(--ink)", "var(--cap)"];

export function MilestoneRoad() {
	const step = RIDE / STONES.length;
	return (
		<div className="relative flex-1">
			<svg viewBox="0 0 371 258" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="absolute inset-0 h-full w-full">
				<path d={ROAD} stroke="var(--line-strong)" strokeWidth="2" />
				<g className="motion-reduce:hidden">
					{STONES.map((c, i) => (
						<g key={i}>
							<animateMotion dur={`${RIDE}s`} begin={`${-i * step}s`} repeatCount="indefinite" calcMode="linear" rotate="auto" path={ROAD} />
							<path d="M-11 -14v-3a11 11 0 0 1 22 0v3Z" fill={c} />
							<path d="M-11 -12h22v12h-22Z" fill="var(--ink)" />
						</g>
					))}
				</g>
			</svg>
			<div className="absolute inset-x-0 bottom-5 hidden justify-center gap-3 motion-reduce:flex" aria-hidden="true">
				{STONES.map((c, i) => (
					<span key={i} className="grid w-5 gap-px">
						<span className="nm-arch h-2.5" style={{ background: c }} />
						<span className="h-3 bg-[var(--ink)]" />
					</span>
				))}
			</div>
		</div>
	);
}

/* Community: posts ranked by helpful, never by likes. */
function HelpfulPosts() {
	const posts = [
		{ c: "var(--stage-leader)", who: "Marcus Bell · Milestone", t: "Ran my first promotion cycle for a team of nine.", n: "41 found this helpful" },
		{ c: "var(--stage-student)", who: "Jenna Ortiz · Question", t: "One big project or three small ones for a first frontend role?", n: "12 replies" },
	];
	return (
		<div className="flex flex-1 flex-col justify-center gap-2.5 px-5 pb-6 pt-6">
			{posts.map((p) => (
				<div key={p.who} className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--paper)] p-3">
					<p className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
						<i className="h-2 w-2.5 rounded-t-full rounded-b-[1px]" style={{ background: p.c }} />
						{p.who}
					</p>
					<p className="mt-1.5 text-[14px] font-medium leading-5">{p.t}</p>
					<p className="nm-mono mt-2 text-xs text-[var(--ink-muted)]">{p.n}</p>
				</div>
			))}
		</div>
	);
}

export function FeatureAreas() {
	return (
		<section id="areas" aria-labelledby="h-areas" className="py-14 md:py-[104px]">
			<div className="nm-wrap">
				<div className="mb-12 grid items-end gap-6 md:grid-cols-[6fr_5fr] md:gap-12">
					<h2 id="h-areas" className="nm-h2">
						Everything the next step can come from.
					</h2>
					<p className="nm-lead">
						Six areas share one plan, one calendar and one profile. Use the ones your stage needs; the rest stay quiet.
					</p>
				</div>

				<div className="flex flex-col gap-5">
					<div className="grid gap-5 lg:grid-cols-[1fr_1.25fr_1fr]">
						<Card className="pt-8">
							<Title fact="4 launch paths">Learn the skill your matches ask for</Title>
							<SkillGrid />
						</Card>
						<Card>
							<h3 className="sr-only">Jobs fetched every morning and ranked against your profile</h3>
							<MatchList />
							<p className="px-6 pb-6 text-center text-[15px] text-[var(--ink-muted)]">
								<b className="font-semibold text-[var(--ink)]">Jobs, ranked for you.</b> About 30 sources, a tailored resume
								when you shortlist one.
							</p>
						</Card>
						<Card className="pb-7">
							<PrepCard />
							<Title fact="Text or voice answers">Practice what actually gets asked</Title>
						</Card>
					</div>

					<div className="grid gap-5 lg:grid-cols-3">
						<Card className="min-h-[264px] pt-6">
							<Title fact="Google Calendar sync">Focus blocks around your week</Title>
							<WeekView />
						</Card>
						<Card className="min-h-[264px] pb-7">
							<MilestoneRoad />
							<Title fact="Public or private, per milestone">A record of what you shipped</Title>
						</Card>
						<Card className="min-h-[264px] pt-6">
							<Title fact="Invite-only at launch">Advice from a few steps ahead</Title>
							<HelpfulPosts />
						</Card>
					</div>
				</div>
			</div>
		</section>
	);
}
