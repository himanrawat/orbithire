// "One screen. One next step." The framed Today screen from the website template.

import { BookOpen, Briefcase, Home, MessagesSquare, Timer, User, Users } from "lucide-react";
import { Lockup } from "./logo";

const NAV = [
	{ icon: Home, label: "Today", on: true },
	{ icon: BookOpen, label: "Learn" },
	{ icon: MessagesSquare, label: "Interview prep" },
	{ icon: Timer, label: "Focus" },
	{ icon: Briefcase, label: "Jobs" },
	{ icon: Users, label: "Community" },
	{ icon: User, label: "Profile" },
];

const MATCHES = [
	{ score: 92, role: "Frontend engineer II", where: "Kestrel Pay · Austin, TX" },
	{ score: 86, role: "Senior UI engineer", where: "Harbor Labs · Remote, US" },
	{ score: 81, role: "Web platform engineer", where: "Tidewater Health · Boston, MA" },
];

const NOTES = [
	["The next step comes with its reason.", "“Not today” moves it aside and teaches the plan what you skip."],
	["A plan of 3 to 5 items,", "drawn from interviews, lessons, focus blocks and shortlisted jobs."],
	["Jobs stay in their lane:", "the three best new matches, scored against your profile."],
];

export function TodaySection() {
	return (
		<section id="today" aria-labelledby="h-today" className="py-14 md:py-[104px]">
			<div className="nm-wrap">
				<div className="mb-12 grid items-end gap-6 md:grid-cols-[6fr_5fr] md:gap-12">
					<h2 id="h-today" className="nm-h2">
						One screen. One next step.
					</h2>
					<p className="nm-lead">
						Today replaces the dashboard of counts. A short plan made at 6:30 AM, the three best new jobs, and what&apos;s
						coming up this week.
					</p>
				</div>

				<div className="nm-grain rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3 [--grain-o:.35] md:p-6">
					<div
						className="relative z-[2] grid min-h-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--paper)] md:min-h-[520px] lg:grid-cols-[220px_1fr_320px]"
						role="img"
						aria-label="The Today screen on desktop"
					>
						<div className="hidden content-start gap-0.5 border-r border-[var(--line)] bg-[var(--surface)] px-3 py-5 lg:grid">
							<Lockup className="mx-2 mb-5 block w-[132px]" />
							{NAV.map(({ icon: Icon, label, on }) => (
								<span
									key={label}
									className={`flex h-9 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-sm font-medium ${
										on ? "bg-[var(--surface-sunken)] text-[var(--ink)]" : "text-[var(--ink-muted)]"
									}`}
								>
									<Icon size={18} strokeWidth={1.75} />
									{label}
								</span>
							))}
						</div>

						<div className="grid content-start gap-3 p-5 md:p-7">
							<p className="nm-display text-[26px] font-[680] leading-[30px] tracking-[-0.02em] md:text-[32px] md:leading-9">
								Good morning, Maya
							</p>
							<p className="text-sm text-[var(--ink-muted)]">Wednesday, Oct 22 · plan made at 6:30 AM</p>
							<div className="nm-next mt-2">
								<div className="hd">
									<div className="k">
										<span className="nm-arch h-1.5 w-[11px] bg-[var(--cap)]" aria-hidden="true" />
										Your next step
									</div>
									<p className="ttl">Practice “Design a URL shortener”</p>
									<p className="why">Round 2 at Kestrel Pay is on Friday. You haven&apos;t practiced a system-design question yet.</p>
									<div className="acts">
										<span className="go">Start · 20 min</span>
										<span className="no">Not today</span>
									</div>
								</div>
							</div>
							<div className="nm-pi done" style={{ borderLeftColor: "var(--kind-focus)" }}>
								<b />
								Focus block<em>50 min</em>
							</div>
							<div className="nm-pi done" style={{ borderLeftColor: "var(--kind-learn)" }}>
								<b />
								Lesson 6: caching<em>12 min</em>
							</div>
							<div className="nm-pi" style={{ borderLeftColor: "var(--kind-jobs)" }}>
								<b />
								Review 3 new matches<em>10 min</em>
							</div>
						</div>

						<div className="grid content-start gap-3 border-t border-[var(--line)] bg-[var(--surface)] p-5 lg:border-l lg:border-t-0">
							<h3 className="text-[13px] font-semibold text-[var(--ink-muted)]">Top new matches</h3>
							{MATCHES.map((m) => (
								<div key={m.role} className="flex items-center gap-3 text-[15px] font-medium leading-5">
									<span
										className={`nm-mono grid size-10 flex-none place-items-center rounded-[var(--radius-sm)] text-sm font-semibold ${
											m.score >= 85 ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--surface-sunken)]"
										}`}
									>
										{m.score}
									</span>
									<span>
										{m.role}
										<small className="block text-[13px] font-normal text-[var(--ink-muted)]">{m.where}</small>
									</span>
								</div>
							))}
							<h3 className="mt-3 text-[13px] font-semibold text-[var(--ink-muted)]">Coming up</h3>
							<div className="nm-pi" style={{ borderLeftColor: "var(--kind-interview)" }}>
								Kestrel Pay, round 2<em>Fri 9:00 AM</em>
							</div>
							<div className="nm-pi" style={{ borderLeftColor: "var(--kind-focus)" }}>
								Focus block<em>Thu 7:00 AM</em>
							</div>
							<p className="text-[13px] leading-[18px] text-[var(--ink-muted)]">
								Press{" "}
								<span className="nm-mono rounded border border-[var(--line-strong)] px-1.5 py-0.5 text-xs">⌘K</span> to jump
								anywhere
							</p>
						</div>
					</div>
				</div>

				<div className="mt-8 grid gap-6 md:grid-cols-3">
					{NOTES.map(([b, rest]) => (
						<div key={b} className="flex gap-3 text-[15px] leading-[22px]">
							<span className="mt-1 grid w-3 flex-none gap-px" aria-hidden="true">
								<span className="nm-arch h-1.5 bg-[var(--cap)]" />
								<span className="h-3 bg-[var(--ink)]" />
							</span>
							<span>
								<b className="font-semibold">{b}</b> <span className="text-[var(--ink-muted)]">{rest}</span>
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
