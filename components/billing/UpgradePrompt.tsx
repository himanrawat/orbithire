// A plain "this is part of Pro" note with a link to the pricing page. No pressure copy.

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPGRADE_HREF } from "@/lib/billing/gates";

type UpgradePromptProps = Readonly<{
	message: string;
	title?: string;
	/** "inline" for a one-line hint under a control, "card" for a full panel. */
	variant?: "inline" | "card";
	className?: string;
}>;

export function UpgradeLink({ className }: Readonly<{ className?: string }>) {
	return (
		<Link
			href={UPGRADE_HREF}
			className={cn(
				"font-semibold text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				className
			)}
		>
			Upgrade to Pro
		</Link>
	);
}

export function UpgradePrompt({ message, title, variant = "card", className }: UpgradePromptProps) {
	if (variant === "inline") {
		return (
			<p className={cn("text-sm text-muted-foreground", className)}>
				{message} <UpgradeLink />
			</p>
		);
	}
	return (
		<section className={cn("space-y-3 rounded-[var(--radius-md)] border bg-card p-5", className)}>
			<div className="flex items-center gap-2">
				<Sparkles className="h-4 w-4 text-[var(--cap-ink)]" aria-hidden="true" />
				<h2 className="font-display text-base font-[650]">{title ?? "Part of Pro"}</h2>
			</div>
			<p className="text-sm leading-6 text-muted-foreground">{message}</p>
			<Link
				href={UPGRADE_HREF}
				className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-cap px-4 text-sm font-semibold text-cap-foreground hover:bg-[var(--cap-press)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				Upgrade to Pro
			</Link>
		</section>
	);
}
