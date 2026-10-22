import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = pageMetadata(
	"/contact",
	"Contact | NextMilestone",
	"Write to the NextMilestone team. A person reads every message and replies by email.",
);

const CONTACT_EMAIL = "info@himanshurawat.in";

const SHORTCUTS = [
	{ href: "/faq", title: "Questions", blurb: "Who it's for, the phone app, AI drafts and privacy." },
	{ href: "/privacy", title: "Privacy", blurb: "What we store, and how to export or delete it." },
	{ href: "/terms", title: "Terms", blurb: "The agreement for using NextMilestone." },
];

export default function ContactPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	return (
		<MarketingShell redirectQuery={getRedirectQuery(searchParams)}>
			<section aria-labelledby="h1" className="pb-14 pt-10 md:pb-[104px] md:pt-20">
				<div className="nm-wrap grid gap-12 lg:grid-cols-[5fr_6fr] lg:gap-16">
					<div>
						<span className="nm-mono text-xs font-medium text-[var(--ink-muted)]">Contact</span>
						<h1
							id="h1"
							className="nm-display mt-4 text-[44px] leading-[44px] tracking-[-0.03em] md:text-[64px] md:leading-[62px] xl:text-[80px] xl:leading-[76px]"
						>
							Write to us. <span className="font-normal text-[var(--ink-muted)]">A person replies.</span>
						</h1>
						<p className="nm-lead mt-6">
							Questions, feedback, a bug, or something you wish NextMilestone did. Every message is read by the team.
						</p>

						<a
							href={`mailto:${CONTACT_EMAIL}`}
							className="group mt-10 flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--line-control)]"
						>
							<span className="grid size-11 flex-none place-items-center rounded-[var(--radius-control)] bg-[var(--cap-soft)] text-[var(--cap-ink)]">
								<Mail size={20} strokeWidth={1.75} aria-hidden="true" />
							</span>
							<span className="min-w-0">
								<span className="block text-[13px] font-semibold text-[var(--ink-muted)]">Prefer email?</span>
								<span className="block truncate text-[17px] font-semibold">{CONTACT_EMAIL}</span>
							</span>
							<ArrowRight size={18} strokeWidth={1.75} className="ml-auto flex-none transition-transform group-hover:translate-x-1" aria-hidden="true" />
						</a>

						<ul className="mt-8 grid">
							{SHORTCUTS.map((s) => (
								<li key={s.href}>
									<Link href={s.href} className="group grid grid-cols-[1fr_auto] items-center gap-4 border-t border-[var(--line)] py-4">
										<span>
											<b className="block text-[17px] font-semibold">{s.title}</b>
											<span className="text-[15px] text-[var(--ink-muted)]">{s.blurb}</span>
										</span>
										<ArrowRight size={18} strokeWidth={1.75} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lift)] md:p-10 lg:self-start">
						<h2 className="nm-display mb-6 text-[26px] font-[650] leading-8 tracking-[-0.02em] md:text-[32px] md:leading-9">Send a message</h2>
						<ContactForm />
					</div>
				</div>
			</section>
		</MarketingShell>
	);
}
