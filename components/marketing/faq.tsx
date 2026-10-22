// FAQ adapted from 21st.dev mohammadshehadeh/faq-05 (Hirael, MIT · Mohammad Shehadeh):
// a bordered two-column block, intro on the left and the accordion on the right.
// Answers state only what the product plan commits to; pricing is left out until it's set.

"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FAQS } from "./faq-data";

export function Faq() {
	return (
		<section id="faq" data-slot="faq" className="py-16 md:py-24">
			<div className="nm-wrap">
				<div className="mx-auto grid w-full max-w-5xl grid-cols-1 border-y border-[var(--line)] md:grid-cols-2 md:border-x">
					<div
						data-slot="faq-intro"
						className="flex flex-col gap-4 border-b border-[var(--line)] px-6 pb-6 pt-12 md:border-b-0 md:border-e md:px-10 md:py-16"
					>
						<span className="nm-mono text-xs font-medium text-[var(--ink-muted)]">Questions</span>
						<h2 className="nm-display text-4xl font-[680] leading-[1.04] tracking-[-0.025em] md:text-5xl">
							Questions, answered.
						</h2>
						<p className="max-w-sm text-[15px] text-[var(--ink-muted)]">
							The things people ask before they start. Still unsure?{" "}
							<a href="/contact" className="text-[var(--info)] underline underline-offset-2">
								Write to us
							</a>{" "}
							and a person will reply.
						</p>
					</div>

					<div data-slot="faq-list" className="flex flex-col justify-center px-6 py-4 md:px-8">
						<Accordion type="single" collapsible className="w-full">
							{FAQS.map((item) => (
								<AccordionItem key={item.id} value={item.id} className="border-[var(--line)]">
									<AccordionTrigger className="min-h-[44px] text-[17px] font-semibold leading-[22px] hover:no-underline">
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
