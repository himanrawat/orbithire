// The heading every app screen opens with: an optional back link, the title in the display
// face, a one-line lead, and the screen's actions on the right (stacked under it on phones).

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
	title,
	description,
	icon,
	back,
	actions,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	/** a lucide icon element, shown in a soft tile beside the title */
	icon?: ReactNode;
	back?: { href: string; label: string };
	actions?: ReactNode;
	className?: string;
}) {
	return (
		<header className={cn("mb-8", className)}>
			{back && (
				<Link
					href={back.href}
					className="-ml-1 mb-4 inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-sm)] px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronLeft className="h-4 w-4" />
					{back.label}
				</Link>
			)}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="flex min-w-0 items-start gap-3">
					{icon && (
						<span className="mt-0.5 grid size-10 flex-none place-items-center rounded-[var(--radius-control)] bg-secondary text-foreground [&_svg]:h-5 [&_svg]:w-5">
							{icon}
						</span>
					)}
					<div className="min-w-0">
						<h1 className="font-display text-[28px] font-[680] leading-[34px] tracking-[-0.02em] md:text-[34px] md:leading-[40px]">
							{title}
						</h1>
						{description && (
							<p className="mt-1.5 max-w-[68ch] text-[15px] leading-[22px] text-muted-foreground">{description}</p>
						)}
					</div>
				</div>
				{actions && <div className="flex flex-wrap items-center gap-2 sm:flex-none">{actions}</div>}
			</div>
		</header>
	);
}
