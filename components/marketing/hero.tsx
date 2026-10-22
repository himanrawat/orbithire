"use client";

// Hero adapted from 21st.dev vaib215/hero-with-product-mockup: copy on the left, a desktop
// window tilted over stacked sheets, and a phone in front. The window and phone show the
// real Today screen; the stage picker from the website template swaps the plan.

import { useState } from "react";
import { Search } from "lucide-react";
import { Btn } from "./btn";
import { Mark } from "./logo";

type Kind = "focus" | "learn" | "prep" | "jobs";
type Stage = {
	label: string;
	color: string;
	title: string;
	why: string;
	go: string;
	count: string;
	road: string;
	items: [Kind, string, string, boolean][];
};

const STAGES: Record<string, Stage> = {
	student: {
		label: "Student",
		color: "var(--stage-student)",
		title: "Finish lesson 3 of “Web foundations”",
		why: "You are 2 lessons from finishing the path you picked for internships.",
		go: "Start · 15 min",
		count: "1 of 4 done",
		road: "next: first internship",
		items: [
			["learn", "Lesson 2: the box model", "12 min", true],
			["prep", "Practice “What happens when you type a URL?”", "15 min", false],
			["learn", "Log one thing you learned", "2 min", false],
			["focus", "Focus block", "25 min", false],
		],
	},
	early: {
		label: "Early career",
		color: "var(--stage-early)",
		title: "Review 3 new matches above 80",
		why: "They arrived at 7:00 AM and two of them close within a week.",
		go: "Review · 10 min",
		count: "1 of 4 done",
		road: "next: a better-fitting role",
		items: [
			["focus", "Focus block", "50 min", true],
			["jobs", "Tailor resume for Kestrel Pay", "15 min", false],
			["prep", "Practice 2 JavaScript questions", "20 min", false],
			["jobs", "Follow up with Harbor Labs", "5 min", false],
		],
	},
	experienced: {
		label: "Experienced",
		color: "var(--stage-experienced)",
		title: "Practice “Design a URL shortener”",
		why: "Your Kestrel Pay interview is in 2 days, and this question comes up most for the role.",
		go: "Start · 20 min",
		count: "2 of 4 done",
		road: "next: senior engineer",
		items: [
			["focus", "Focus block", "50 min", true],
			["learn", "Lesson 6: caching", "12 min", true],
			["jobs", "Review 3 new matches", "10 min", false],
			["learn", "Log one thing you learned", "2 min", false],
		],
	},
	leader: {
		label: "Leader",
		color: "var(--stage-leader)",
		title: "Add the platform migration as a milestone",
		why: "You finished it last week. It is still private, and two people asked how it went.",
		go: "Add milestone · 5 min",
		count: "1 of 3 done",
		road: "next: head of engineering",
		items: [
			["prep", "Practice a stakeholder question", "15 min", true],
			["focus", "Write the Q1 hiring plan", "90 min", false],
			["learn", "Reply to a mentoring request", "10 min", false],
		],
	},
};

function NextMark() {
	return (
		<span className="grid w-[11px] gap-[1.5px]" aria-hidden="true">
			<span className="h-[6px] rounded-t-[6px] rounded-b-[1px] bg-[var(--cap)]" />
			<span className="h-2 bg-[var(--ink)]" />
		</span>
	);
}

export function Hero({ redirectQuery }: { redirectQuery: string }) {
	const [key, setKey] = useState("experienced");
	const [swap, setSwap] = useState(false);
	const s = STAGES[key];

	const pick = (k: string) => {
		if (k === key) return;
		setSwap(true);
		window.setTimeout(() => {
			setKey(k);
			requestAnimationFrame(() => requestAnimationFrame(() => setSwap(false)));
		}, 160);
	};

	const fade = `transition-[opacity,transform] [transition-duration:420ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] ${swap ? "translate-y-2 opacity-0" : ""}`;

	return (
		<section aria-labelledby="h1" className="overflow-hidden pb-24 pt-8 md:pb-32 md:pt-20">
			<div className="nm-wrap grid items-center gap-16 lg:grid-cols-[6fr_6fr] lg:gap-12">
				{/* copy */}
				<div className="max-w-2xl">
					<h1
						id="h1"
						className="nm-display text-[48px] leading-[46px] tracking-[-0.03em] md:text-[72px] md:leading-[68px] xl:text-[96px] xl:leading-[88px] xl:tracking-[-0.035em]"
					>
						Know your next&nbsp;step. <span className="font-normal text-[var(--ink-muted)]">Then take&nbsp;it.</span>
					</h1>
					<p className="mt-6 max-w-[34ch] text-[17px] leading-[26px] text-[var(--ink-muted)] md:text-xl md:leading-[30px]">
						Every morning NextMilestone looks at your interviews, your learning and your job matches, and puts the one most
						useful thing at the top. With the reason.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Btn href={`/signup${redirectQuery}`} arrow className="max-sm:w-full max-sm:justify-center">
							Get started
						</Btn>
						<Btn href="#today" variant="secondary" className="max-sm:w-full max-sm:justify-center">
							See how Today works
						</Btn>
					</div>
					<p className="nm-mono mt-6 text-[13px] font-medium leading-[18px] text-[var(--ink-muted)]">
						Setup takes about 2 minutes · every step can be skipped
					</p>

					<div
						className="mt-10 grid w-full grid-cols-2 gap-1.5 rounded-[14px] bg-[var(--surface-sunken)] p-1 sm:flex sm:w-fit"
						role="group"
						aria-label="Show the plan for a career stage"
					>
						{Object.entries(STAGES).map(([k, v]) => (
							<button
								key={k}
								type="button"
								aria-pressed={k === key}
								onClick={() => pick(k)}
								className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-[var(--ink-muted)] transition-colors aria-pressed:bg-[var(--surface)] aria-pressed:text-[var(--ink)] aria-pressed:shadow-[0_1px_2px_rgba(16,18,22,.08)]"
							>
								<i className="h-2 w-2.5 rounded-t-full rounded-b-[1px]" style={{ background: v.color }} />
								{v.label}
							</button>
						))}
					</div>
				</div>

				{/* mockups */}
				<div className="relative isolate mx-auto mb-10 w-full max-w-[460px] lg:mb-0">
					{/* stacked sheets behind: printed paper in two stage colours, with grain */}
					<div
						aria-hidden="true"
						className="nm-grain absolute -left-8 -top-8 -z-20 h-full w-full rotate-[10deg] rounded-[var(--radius-lg)] shadow-[var(--shadow-float)] transition-colors [transition-duration:420ms] max-sm:hidden"
						style={{ background: "var(--ink)" }}
					/>
					<div
						aria-hidden="true"
						className="nm-grain absolute -left-4 -top-4 -z-10 h-full w-full rotate-[5deg] rounded-[var(--radius-lg)] shadow-[var(--shadow-float)] transition-colors [transition-duration:420ms] max-sm:hidden"
						style={{ background: s.color }}
					/>

					{/* desktop window */}
					<div
						className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--paper)] shadow-[var(--shadow-float)] transition-transform duration-300 sm:rotate-2 sm:hover:rotate-1"
						role="img"
						aria-label={`The Today screen for ${s.label.toLowerCase()} stage: ${s.title}`}
					>
						<div className="flex items-center gap-4 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3">
							<div className="flex gap-1.5" aria-hidden="true">
								<span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
								<span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
								<span className="size-2.5 rounded-full bg-[var(--line-strong)]" />
							</div>
							<div className="flex flex-1 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-[13px] text-[var(--ink-muted)]">
								<Search size={14} strokeWidth={1.75} />
								Jump anywhere
								<span className="nm-mono ml-auto text-xs">⌘K</span>
							</div>
						</div>
						<div className="p-5 sm:p-6">
							<p className="nm-display text-[26px] font-[650] leading-[30px] tracking-[-0.02em]">Good morning, Maya</p>
							<p className="nm-mono mt-1 text-xs text-[var(--ink-muted)]">Wed, Oct 22 · plan made at 6:30 AM</p>
							<div className="nm-next mt-4" aria-live="polite">
								<div className="hd">
									<div className={`k ${fade}`}>
										<NextMark />
										Your next step
									</div>
									<p className={`ttl !text-lg !leading-6 ${fade}`} style={{ transitionDelay: "30ms" }}>
										{s.title}
									</p>
									<p className={`why ${fade}`} style={{ transitionDelay: "60ms" }}>
										{s.why}
									</p>
									<div className={`acts ${fade}`} style={{ transitionDelay: "90ms" }}>
										<span className="go">{s.go}</span>
										<span className="no">Not today</span>
									</div>
								</div>
								<div className="grid gap-2 px-5 pb-5 pt-4">
									<div className="flex justify-between text-[13px] font-semibold leading-4 text-[var(--ink-muted)]">
										Today&apos;s plan<span className="nm-mono font-medium">{s.count}</span>
									</div>
									{s.items.slice(0, 3).map(([kind, label, time, done], i) => (
										<div
											key={key + i}
											className={`nm-pi ${done ? "done" : ""} ${fade}`}
											style={{ borderLeftColor: `var(--kind-${kind})`, transitionDelay: `${120 + i * 30}ms` }}
										>
											<b />
											<span className="truncate">{label}</span>
											<em>{time}</em>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* phone */}
					<div className="absolute -bottom-12 -right-4 w-[150px] rotate-[-8deg] rounded-[2.2rem] bg-[#101216] p-1.5 shadow-[var(--shadow-float)] transition-transform duration-300 hover:rotate-[-4deg] sm:-right-14 sm:w-[176px]">
						<div className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-[var(--paper)]">
							<div className="flex items-center justify-between px-4 pb-1 pt-2.5 text-[10px] font-semibold">
								<span className="nm-mono">9:41</span>
								<span className="h-1.5 w-8 rounded-full bg-[var(--ink)]" />
							</div>
							<div className="grid gap-2 px-3 pb-3 pt-2">
								<Mark className="h-6 w-auto self-start justify-self-start" />
								<p className="nm-display text-[17px] font-[650] leading-5">Today</p>
								<div className="rounded-[10px] bg-[var(--cap-soft)] p-2.5">
									<p className="text-[10px] font-semibold text-[var(--cap-ink)]">Your next step</p>
									<p className={`mt-0.5 text-[11px] font-semibold leading-[14px] ${fade}`}>{s.title}</p>
									<span className="mt-2 inline-block rounded-md bg-[var(--cap)] px-2 py-1 text-[10px] font-semibold text-[var(--on-cap)]">
										Start
									</span>
								</div>
								{/* the road: past stones in ink, the next one in this stage's colour */}
								<div className="mt-1 flex h-12 items-end gap-2.5 border-b-2 border-[var(--line-strong)] px-1" aria-hidden="true">
									{[18, 22, 26, 34, 30, 34].map((h, i) => (
										<div key={i} className="grid w-3 gap-px">
											<div
												className="nm-arch h-1.5 transition-colors [transition-duration:420ms]"
												style={{ background: i < 3 ? "var(--ink)" : i === 3 ? s.color : "var(--ink-faint)" }}
											/>
											<div style={{ height: h * 0.6, background: i <= 3 ? "var(--ink)" : "var(--line-strong)" }} />
										</div>
									))}
								</div>
								<p className={`nm-mono text-[9px] text-[var(--ink-muted)] ${fade}`}>{s.road}</p>
							</div>
							<div className="grid grid-cols-5 border-t border-[var(--line)] px-2 py-2 text-center text-[8px] font-medium text-[var(--ink-muted)]" aria-hidden="true">
								<span className="text-[var(--ink)]">Today</span>
								<span>Learn</span>
								<span className="mx-auto grid size-4 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)]">+</span>
								<span>Jobs</span>
								<span>Me</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
