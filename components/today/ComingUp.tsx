import Link from "next/link";
import { Bell, CalendarClock, Timer } from "lucide-react";
import { SectionHeader } from "@/components/app/blocks";
import { safeTimeZone } from "@/lib/today/nextStep";
import type { ComingUpItem } from "@/lib/today/types";

function formatWhen(iso: string, timeZone: string): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: safeTimeZone(timeZone),
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function KindIcon({ kind }: Readonly<{ kind: ComingUpItem["kind"] }>) {
	if (kind === "interview") {
		return <CalendarClock className="h-4 w-4 text-[var(--kind-interview)]" aria-hidden="true" />;
	}
	if (kind === "focus") {
		return <Timer className="h-4 w-4 text-[var(--kind-focus)]" aria-hidden="true" />;
	}
	return <Bell className="h-4 w-4 text-[var(--kind-prep)]" aria-hidden="true" />;
}

/** The next interview and follow-up. Focus blocks join here with the focus timer. */
export function ComingUp({ items, timeZone }: Readonly<{ items: readonly ComingUpItem[]; timeZone: string }>) {
	return (
		<section aria-labelledby="coming-up-heading" className="rounded-[var(--radius-md)] border bg-card p-5">
			<SectionHeader title={<span id="coming-up-heading">Coming up</span>} />
			{items.length === 0 ? (
				<p className="text-sm text-muted-foreground">Nothing scheduled. Add an interview date to an application to see it here.</p>
			) : (
				<ul className="space-y-2">
					{items.map((item) => (
						<li key={item.id}>
							<Link
								href={item.href}
								className="flex items-start gap-3 rounded-[var(--radius-sm)] p-2 transition-colors hover:bg-muted/50"
							>
								<span className="mt-0.5">
									<KindIcon kind={item.kind} />
								</span>
								<span className="min-w-0">
									<span className="block font-medium">{item.title}</span>
									<time dateTime={item.at} className="block text-sm text-muted-foreground">
										{formatWhen(item.at, timeZone)}
									</time>
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
