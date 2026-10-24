import { cn } from "@/lib/utils";
import type { WeekDay } from "@/lib/today/types";

const STATE_LABEL: Readonly<Record<WeekDay["state"], string>> = {
	active: "done",
	today: "today",
	open: "no plan item done",
	upcoming: "upcoming",
};

function dayName(date: string): string {
	return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Monday to Sunday: a filled dot for each day with a plan item done. Progress only. */
export function WeekCard({ week }: Readonly<{ week: readonly WeekDay[] }>) {
	return (
		<section aria-labelledby="week-heading" className="rounded-[var(--radius-md)] border bg-card p-4">
			<h2 id="week-heading" className="text-[15px] font-semibold">
				This week
			</h2>
			<ol className="mt-3 grid grid-cols-7 gap-1.5 text-center">
				{week.map((day) => (
					<li key={day.date} className="flex flex-col items-center gap-1.5">
						<span className="text-xs text-muted-foreground" aria-hidden="true">
							{day.label}
						</span>
						<span
							className={cn(
								"block h-3.5 w-3.5 rounded-full",
								day.state === "active" && "bg-[var(--kind-learn)]",
								day.state === "today" && "border-2 border-foreground",
								(day.state === "open" || day.state === "upcoming") && "bg-muted"
							)}
						/>
						<span className="sr-only">
							{dayName(day.date)}: {STATE_LABEL[day.state]}
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}
