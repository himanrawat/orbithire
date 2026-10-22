// Privacy and Terms: the page heading from the inner pages, a sticky contents list, and
// numbered sections between hairlines, set for long reading.

import type { ReactNode } from "react";
import Link from "next/link";

export type LegalSection = { id: string; title: string; body: ReactNode };

/* Shared prose styles for a section body: paragraphs and plain bullet lists. */
const PROSE =
	"grid gap-4 text-[17px] leading-[28px] text-[var(--ink-muted)] [&_a]:text-[var(--info)] [&_a]:underline [&_a]:underline-offset-2 [&_b]:font-semibold [&_b]:text-[var(--ink)] [&_li]:relative [&_li]:pl-5 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[11px] [&_li]:before:h-1.5 [&_li]:before:w-2 [&_li]:before:rounded-t-full [&_li]:before:rounded-b-[1px] [&_li]:before:bg-[var(--cap)] [&_ul]:grid [&_ul]:gap-2";

export function LegalPage({
	eyebrow,
	title,
	intro,
	updated,
	sections,
}: Readonly<{
	eyebrow: string;
	title: string;
	intro: ReactNode;
	updated: string;
	sections: LegalSection[];
}>) {
	return (
		<>
			<section aria-labelledby="h1" className="pb-10 pt-10 md:pb-16 md:pt-20">
				<div className="nm-wrap">
					<span className="nm-mono text-xs font-medium text-[var(--ink-muted)]">{eyebrow}</span>
					<h1
						id="h1"
						className="nm-display mt-4 text-[44px] leading-[44px] tracking-[-0.03em] md:text-[64px] md:leading-[62px] xl:text-[80px] xl:leading-[76px]"
					>
						{title}
					</h1>
					<p className="nm-lead mt-6">{intro}</p>
					<p className="nm-mono mt-6 text-[13px] font-medium text-[var(--ink-muted)]">Last updated {updated}</p>
				</div>
			</section>

			<div className="nm-wrap grid gap-10 pb-14 md:pb-[104px] lg:grid-cols-[240px_1fr] lg:gap-16">
				<nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
					<p className="mb-3 text-[13px] font-semibold text-[var(--ink-muted)]">On this page</p>
					<ol className="grid gap-0.5 max-lg:grid-cols-1 sm:max-lg:grid-cols-2">
						{sections.map((s, i) => (
							<li key={s.id}>
								<a
									href={`#${s.id}`}
									className="flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[15px] font-medium text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
								>
									<span className="nm-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
									{s.title}
								</a>
							</li>
						))}
					</ol>
				</nav>

				<div className="max-w-[72ch]">
					{sections.map((s, i) => (
						<section
							key={s.id}
							id={s.id}
							aria-labelledby={`h-${s.id}`}
							className="grid gap-4 border-t border-[var(--line)] py-8 first:border-t-0 first:pt-0 md:grid-cols-[48px_1fr]"
						>
							<span className="nm-mono pt-1.5 text-[13px] font-medium text-[var(--ink-muted)]">{String(i + 1).padStart(2, "0")}</span>
							<div>
								<h2 id={`h-${s.id}`} className="nm-display mb-4 text-[26px] font-[650] leading-8 tracking-[-0.02em] md:text-[30px] md:leading-9">
									{s.title}
								</h2>
								<div className={PROSE}>{s.body}</div>
							</div>
						</section>
					))}

					<div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6">
						<p className="text-[17px] font-semibold">Something unclear?</p>
						<p className="mt-1 text-[15px] leading-[22px] text-[var(--ink-muted)]">
							<Link href="/contact" className="text-[var(--info)] underline underline-offset-2">
								Write to us
							</Link>{" "}
							and a person will reply. You can also read the{" "}
							<Link href="/faq" className="text-[var(--info)] underline underline-offset-2">
								questions page
							</Link>
							.
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
