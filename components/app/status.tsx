// Application status colors, in one place. They were copied into the dashboard, the
// companies list and the company page with raw Tailwind palette colors.

import { cn } from "@/lib/utils";

export const APPLICATION_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
	saved: { label: "Saved", cls: "bg-secondary text-secondary-foreground", dot: "bg-muted-foreground" },
	applied: { label: "Applied", cls: "bg-[var(--info-soft)] text-[var(--info)]", dot: "bg-[var(--info)]" },
	interviewing: {
		label: "Interviewing",
		cls: "bg-[var(--kind-interview-soft)] text-[var(--kind-interview)]",
		dot: "bg-[var(--kind-interview)]",
	},
	offered: { label: "Offered", cls: "bg-[var(--success-soft)] text-[var(--success)]", dot: "bg-[var(--success)]" },
	rejected: { label: "Rejected", cls: "bg-[var(--danger-soft)] text-[var(--danger)]", dot: "bg-[var(--danger)]" },
	withdrawn: { label: "Withdrawn", cls: "bg-secondary text-muted-foreground", dot: "bg-muted-foreground/60" },
};

/** Class string for a status pill, falling back to "saved". */
export function statusClass(status: string | null | undefined) {
	return (APPLICATION_STATUS[status ?? ""] ?? APPLICATION_STATUS.saved).cls;
}

export function ApplicationStatusBadge({ status, className }: { status: string; className?: string }) {
	const s = APPLICATION_STATUS[status] ?? APPLICATION_STATUS.saved;
	return (
		<span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5", s.cls, className)}>
			{s.label}
		</span>
	);
}
