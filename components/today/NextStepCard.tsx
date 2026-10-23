"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlanItem } from "@/lib/today/nextStep";

type NextStepCardProps = Readonly<{
	step: PlanItem;
	dismissed: boolean;
	onDismiss: () => Promise<void>;
}>;

function DismissedState() {
	return (
		<section
			aria-labelledby="next-step-heading"
			className="flex items-center gap-3 rounded-[var(--radius-md)] border bg-card p-5"
		>
			<CheckCircle2 className="h-5 w-5 flex-none text-[var(--success)]" aria-hidden="true" />
			<div>
				<h2 id="next-step-heading" className="font-display text-base font-[650]">
					Your next step can wait
				</h2>
				<p className="text-sm text-muted-foreground">
					We set it aside for today. Your plan below is still here when you want it.
				</p>
			</div>
		</section>
	);
}

/** "Your next step": one action, its reason, Start and "Not today". */
export function NextStepCard({ step, dismissed, onDismiss }: NextStepCardProps) {
	if (dismissed) return <DismissedState />;
	return (
		<section
			aria-labelledby="next-step-heading"
			className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--cap)_45%,transparent)] bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:p-6"
		>
			<p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
				Your next step
			</p>
			<h2 id="next-step-heading" className="mt-2 font-display text-xl font-[680] leading-7">
				{step.title}
			</h2>
			<p className="mt-1 max-w-[60ch] text-sm leading-5 text-muted-foreground">{step.reason}</p>
			<div className="mt-5 flex flex-wrap gap-2">
				<Button variant="cap" asChild>
					<Link href={step.href}>
						Start
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
				</Button>
				<Button type="button" variant="ghost" onClick={() => void onDismiss()}>
					Not today
				</Button>
			</div>
		</section>
	);
}
