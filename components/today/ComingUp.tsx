import Link from "next/link";
import { Bell, CalendarClock, Timer } from "lucide-react";
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

const MAX_ITEMS = 3;

/** The next interview, follow-up or focus block; at most three. */
export function ComingUp({ items, timeZone }: Readonly<{ items: readonly ComingUpItem[]; timeZone: string }>) {
	return (
		<section aria-labelledby="coming-up-heading" className="rounded-[var(--radius-md)] border bg-card p-4">
			<h2 id="coming-up-heading" className="mb-2 text-[15px] font-semibold">
				Coming up
			</h2>
			{items.length === 0 ? (
				<p className="text-sm text-muted-foreground">Nothing scheduled. Add an interview date to an application to see it here.</p>
			) : (
				<ul className="-mx-2 space-y-1">
					{items.slice(0, MAX_ITEMS).map((item) => (
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
