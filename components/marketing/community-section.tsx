// "Share progress. Keep the rest private." and "How it decides.", from the website template.

import { ThumbsUp } from "lucide-react";

const MILESTONES = [
	{ t: "Finished “Frontend system design”", m: "Oct 2026 · public" },
	{ t: "Shipped the new checkout at Kestrel Pay", m: "Aug 2026 · public" },
	{ t: "Open to roles", m: "visible only to you", priv: true },
	{ t: "10 mock interviews done", m: "Jun 2026 · public" },
];

const POSTS = [
	{
		c: "var(--stage-leader)",
		by: "Marcus Bell",
		role: "Engineering manager · Milestone",
		body: "Ran my first promotion cycle for a team of nine. The thing that helped most: writing each person's case with them, a month early, instead of for them the week before.",
		helpful: true,
		meta: "41 people found this helpful",
	},
	{
		c: "var(--stage-student)",
		by: "Jenna Ortiz",
		role: "Final-year student · Question",
		body: "For a first frontend role, is it worth building one big project or three small ones? I have time for about 6 weeks.",
		helpful: false,
		meta: "12 replies",
	},
];

const PRINCIPLES = [
	["One clear next step", "Each screen leads with the single most useful action. Everything else waits one click away."],
	["Progress, not pressure", "Milestones get celebrated. Missed days don't get mentioned. Notifications say what's ready, never what you missed."],
	["Grows with you", "The same app for a final-year student and a VP. Your stage changes what comes first, not where things are."],
	["AI drafts, you decide", "AI output is labeled, editable and versioned. Nothing is sent, applied for or published without you."],
	["Fast and keyboard-first", "⌘K from anywhere, AA contrast throughout, and every screen works on a phone and with a screen reader."],
];

export function CommunitySection() {
	return (
		<>
			<section id="community" aria-labelledby="h-comm" className="py-14 md:py-[104px]">
				<div className="nm-wrap">
					<h2 id="h-comm" className="nm-h2 mb-12 max-w-[15ch]">
						Share progress. Keep the rest private.
					</h2>
					<div className="grid gap-6 lg:grid-cols-[5fr_6fr] lg:gap-10">
						<div className="grid content-start gap-5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6">
							<div className="flex items-center gap-3">
								{/* avatar in the arch frame */}
								<span
									className="nm-arch grid size-12 place-items-center bg-[var(--surface-sunken)] font-semibold"
									aria-hidden="true"
								>
									MC
								</span>
								<div>
									<b className="block text-[17px] font-semibold">Maya Collins</b>
									<span className="text-sm text-[var(--ink-muted)]">Frontend engineer · experienced · Austin</span>
								</div>
							</div>
							<ol className="relative ml-2 grid gap-5 border-l-2 border-[var(--line-strong)] pl-6" aria-label="Milestones">
								{MILESTONES.map((m) => (
									<li key={m.t} className="relative">
										<span
											className={`nm-arch absolute -left-[33px] top-0.5 h-3.5 w-4 ${m.priv ? "border-[1.5px] border-dashed border-[var(--line-control)] bg-[var(--surface)]" : "bg-[var(--cap)]"}`}
											aria-hidden="true"
										/>
										<b className={`block font-semibold ${m.priv ? "text-[var(--ink-muted)]" : ""}`}>{m.t}</b>
										<span className="nm-mono text-[13px] text-[var(--ink-muted)]">{m.m}</span>
									</li>
								))}
							</ol>
							<span className="justify-self-start rounded-[var(--radius-control)] border border-[var(--line-control)] px-4 py-2 text-[15px] font-semibold">
								Preview as public
							</span>
						</div>

						<div>
							<div className="grid gap-4">
								{POSTS.map((p) => (
									<article key={p.by} className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5">
										<div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
											<i className="h-2.5 w-3 rounded-t-full rounded-b-[1px]" style={{ background: p.c }} />
											<span>
												<b className="font-semibold text-[var(--ink)]">{p.by}</b> · {p.role}
											</span>
										</div>
										<p className="mt-3 text-[17px] leading-[26px]">{p.body}</p>
										<div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--ink-muted)]">
											<span
												className={`inline-flex items-center gap-1.5 font-semibold ${p.helpful ? "text-[var(--cap-ink)]" : "text-[var(--ink)]"}`}
											>
												<ThumbsUp size={16} strokeWidth={1.75} />
												{p.helpful ? "Helpful" : "Mark helpful"}
											</span>
											<span>{p.meta}</span>
											<span>Save</span>
										</div>
									</article>
								))}
							</div>
							<p className="mt-5 text-[15px] text-[var(--ink-muted)]">
								No like counts. No follower counts. Helpful counts live on the post, never on the person.
							</p>
						</div>
					</div>
				</div>
			</section>

			<section aria-labelledby="h-pr" className="pb-14 md:pb-[104px]">
				<div className="nm-wrap grid gap-6 lg:grid-cols-[4fr_7fr] lg:gap-12">
					<h2 id="h-pr" className="nm-display text-[36px] leading-[38px] tracking-[-0.025em] md:text-[44px] md:leading-[46px]">
						How it decides.
					</h2>
					<ul>
						{PRINCIPLES.map(([h, p]) => (
							<li key={h} className="grid gap-2 border-t border-[var(--line)] py-6 last:border-b md:grid-cols-[5fr_6fr] md:gap-8">
								<h3 className="nm-display text-2xl font-[650] leading-7 tracking-[-0.02em] md:text-[28px] md:leading-8">{h}</h3>
								<p className="text-[var(--ink-muted)]">{p}</p>
							</li>
						))}
					</ul>
				</div>
			</section>
		</>
	);
}
