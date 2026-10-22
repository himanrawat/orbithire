// "Practice what actually gets asked." Steps beside the question card, from the website template.

const STEPS = [
	["01", "Think", "Read the question and sketch your approach. A framework hint is there if you want it."],
	["02", "Answer", "Type or speak. Voice answers are transcribed so you can edit them."],
	["03", "Review", "One strength, one gap, one thing to read next. Labelled as AI, always yours to accept."],
];

const FEEDBACK = [
	["Strength", "You split read and write paths before choosing a store, and sized the read load."],
	["Gap", "You didn't say how cached links are invalidated when one is deleted or expires."],
	["Next", "Read “Caching basics”, 8 min."],
];

export function PrepSection() {
	return (
		<section id="prep" aria-labelledby="h-prep" className="py-14 md:py-[104px]">
			<div className="nm-wrap grid items-start gap-10 lg:grid-cols-[5fr_6fr] lg:gap-16">
				<div>
					<h2 id="h-prep" className="nm-h2">
						Practice what actually gets asked.
					</h2>
					<p className="nm-lead mt-5">
						“Most asked” comes from people who report questions after real interviews, plus curated sets per role. Every
						question shows its source.
					</p>
					<ol className="mt-10 grid">
						{STEPS.map(([n, b, p]) => (
							<li key={n} className="grid grid-cols-[48px_1fr] gap-4 border-t border-[var(--line)] py-5 last:border-b">
								<span className="nm-mono pt-0.5 text-[13px] font-medium text-[var(--ink-muted)]">{n}</span>
								<div>
									<b className="text-[17px] font-semibold leading-[22px]">{b}</b>
									<p className="mt-1 text-[var(--ink-muted)]">{p}</p>
								</div>
							</li>
						))}
					</ol>
				</div>

				<div className="grid gap-5 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-lift)] md:p-8">
					<div className="flex flex-wrap gap-2">
						<span className="rounded-full bg-[var(--kind-prep-soft)] px-2.5 py-1 text-[13px] font-medium text-[var(--kind-prep)]">
							System design
						</span>
						<span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-[13px] font-medium">
							Most asked · reported by 38 people
						</span>
						<span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-[13px] font-medium">
							Early career, experienced
						</span>
					</div>
					<h3 className="nm-display text-2xl font-[650] leading-7 tracking-[-0.02em] md:text-[32px] md:leading-9">
						Design a URL shortener that handles 10,000 writes a second.
					</h3>
					<div className="rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--paper)] p-4 text-[15px] leading-[22px]">
						Separate the write path (generate an ID, store the mapping) from the read path, which is 100× hotter. Base62 IDs
						from a counter service, a key-value store for mappings, and a cache in front of reads…
					</div>
					<div
						className="rounded-[var(--radius-md)] border-[1.5px] border-dashed border-[var(--draft-line)] bg-[var(--draft-soft)] p-4"
						aria-label="AI draft feedback"
					>
						<span className="inline-block rounded-full border border-[var(--line-control)] bg-[var(--surface)] px-2.5 py-1 text-[13px] font-medium">
							AI draft · feedback
						</span>
						<ul className="mt-3 grid gap-2">
							{FEEDBACK.map(([b, t]) => (
								<li key={b} className="grid gap-0 text-[15px] leading-[22px] sm:grid-cols-[88px_1fr] sm:gap-3">
									<b className="font-semibold">{b}</b>
									<span className="text-[var(--ink-muted)]">{t}</span>
								</li>
							))}
						</ul>
						<div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
							<span className="rounded-[var(--radius-control)] bg-[var(--ink)] px-3.5 py-2 text-[var(--paper)]">Accept</span>
							<span className="rounded-[var(--radius-control)] border border-[var(--line-control)] bg-[var(--surface)] px-3.5 py-2">
								Edit
							</span>
							<span className="px-3.5 py-2 text-[var(--ink-muted)]">This was wrong</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
