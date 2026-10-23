import { Timer } from "lucide-react";
import { SectionHeader } from "@/components/app/blocks";
import { focusProgress } from "@/lib/today/focus";
import type { WeeklyFocus } from "@/lib/today/types";

/** Focus time in the last 7 days against the weekly goal. No streaks. */
export function WeeklyFocusCard({ focus }: Readonly<{ focus: WeeklyFocus }>) {
	const progress = focusProgress(focus);
	return (
		<section aria-labelledby="focus-heading" className="rounded-[var(--radius-md)] border bg-card p-5">
			<SectionHeader
				icon={<Timer aria-hidden="true" />}
				title={<span id="focus-heading">Focus this week</span>}
			/>
			<p className="font-mono text-2xl font-semibold tabular-nums">{progress.label}</p>
			{progress.percent !== null && (
				<progress
					className="mt-3 h-2 w-full accent-[var(--kind-focus)]"
					aria-label="Progress toward your weekly focus goal"
					value={progress.percent}
					max={100}
				/>
			)}
		</section>
	);
}
