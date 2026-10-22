// Small building blocks shared by the app screens: section headings, stat tiles, empty
// states and loading skeletons, all on the NextMilestone tokens.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A section heading inside a page or card: title, lead and an optional action. */
export function SectionHeader({
	title,
	description,
	icon,
	action,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	icon?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
			<div className="min-w-0">
				<h2 className="flex items-center gap-2 font-display text-lg font-[650] leading-6 tracking-[-0.01em] [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:text-muted-foreground">
					{icon}
					{title}
				</h2>
				{description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>}
			</div>
			{action && <div className="flex-none">{action}</div>}
		</div>
	);
}

/** One number and its label. `tone` tints the icon tile with a product-area color. */
export function StatTile({
	icon,
	value,
	label,
	tone,
	className,
}: {
	icon?: ReactNode;
	value: ReactNode;
	label: ReactNode;
	tone?: "focus" | "learn" | "prep" | "jobs" | "interview";
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-[var(--radius-md)] border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
				className
			)}
		>
			{icon && (
				<span
					className="grid size-10 flex-none place-items-center rounded-[var(--radius-control)] bg-secondary text-foreground [&_svg]:h-5 [&_svg]:w-5"
					style={tone ? { background: `var(--kind-${tone}-soft)`, color: `var(--kind-${tone})` } : undefined}
				>
					{icon}
				</span>
			)}
			<div className="min-w-0">
				<p className="font-mono text-2xl font-semibold leading-7 tracking-[-0.02em] tabular-nums">{value}</p>
				<p className="truncate text-[13px] leading-[18px] text-muted-foreground">{label}</p>
			</div>
		</div>
	);
}

/** The milestone mark: a cap over a stone, the brand's one illustration. */
export function MilestoneMark({ size = 40, className }: { size?: number; className?: string }) {
	return (
		<span className={cn("grid gap-[3px]", className)} style={{ width: size * 0.6 }} aria-hidden="true">
			<span className="nm-arch bg-[var(--cap)]" style={{ height: size * 0.3 }} />
			<span className="bg-foreground/85" style={{ height: size * 0.55 }} />
		</span>
	);
}

/** What a list shows before it has anything: the mark, one line, and at most one action. */
export function EmptyState({
	title,
	description,
	action,
	icon,
	className,
}: {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	/** replaces the milestone mark when a specific icon reads better */
	icon?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
			{icon ? (
				<span className="mb-4 grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground [&_svg]:h-6 [&_svg]:w-6">
					{icon}
				</span>
			) : (
				<MilestoneMark className="mb-4" />
			)}
			<p className="font-display text-base font-[650]">{title}</p>
			{description && <p className="mt-1 max-w-[44ch] text-sm leading-5 text-muted-foreground">{description}</p>}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}

/** A placeholder bar while content loads. */
export function Skeleton({ className }: { className?: string }) {
	return <div aria-hidden="true" className={cn("animate-pulse rounded-[var(--radius-sm)] bg-secondary", className)} />;
}

/** Field style for native <select> elements, matching the Input component. */
export const nativeSelectClass =
	"h-11 w-full rounded-[var(--radius-control)] border border-input bg-card px-3 text-[15px] text-foreground transition-[border-color,box-shadow] duration-[var(--duration-quick)] hover:border-foreground/50 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50";

/** Segmented tabs, as in the marketing site's stage picker: a sunken track, the active tab raised. */
export const tabListClass = "flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-secondary p-1";

export function tabClass(active: boolean) {
	return cn(
		"flex min-h-9 items-center gap-2 rounded-[8px] px-3 text-sm font-semibold transition-colors duration-[var(--duration-quick)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		active ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,18,22,0.08)]" : "text-muted-foreground hover:text-foreground"
	);
}

/** The small count beside a tab label. */
export function tabCountClass(active: boolean) {
	return cn("rounded-full px-1.5 font-mono text-xs tabular-nums", active ? "bg-secondary" : "bg-card/70");
}
