import Link from "next/link";
import type { TodayMatch } from "@/lib/today/types";

function matchMeta(match: TodayMatch): string {
	return [match.company, match.location, match.isRemote ? "Remote" : null].filter(Boolean).join(" · ");
}

function ScoreBadge({ score }: Readonly<{ score: number | null }>) {
	if (score === null) {
		return <span className="w-9 flex-none text-center text-xs text-muted-foreground">New</span>;
	}
	return (
		<span
			className="w-9 flex-none rounded-full bg-[var(--kind-jobs-soft)] py-0.5 text-center font-mono text-sm font-semibold tabular-nums text-[var(--kind-jobs)]"
			aria-label={`Match score ${score} out of 100`}
		>
			{score}
		</span>
	);
}

/** Up to 3 new matches from the Job Inbox, for the Today side column. */
export function TopMatches({ matches }: Readonly<{ matches: readonly TodayMatch[] }>) {
	return (
		<section aria-labelledby="matches-heading" className="rounded-[var(--radius-md)] border bg-card p-4">
			<div className="mb-2 flex items-baseline justify-between gap-3">
				<h2 id="matches-heading" className="text-[15px] font-semibold">
					New jobs for you
				</h2>
				<Link href="/jobs" className="text-[13px] font-medium text-[var(--info)] underline-offset-2 hover:underline">
					See all
				</Link>
			</div>
			{matches.length === 0 ? (
				<p className="text-sm text-muted-foreground">New roles arrive each morning once your job search is set up.</p>
			) : (
				<ul>
					{matches.slice(0, 3).map((m) => (
						<li key={m.id}>
							<Link
								href={`/jobs/${m.id}`}
								className="-mx-2 flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-muted/50"
							>
								<ScoreBadge score={m.score} />
								<span className="min-w-0">
									<span className="block truncate text-sm font-semibold">{m.title}</span>
									<span className="block truncate text-[13px] text-muted-foreground">{matchMeta(m)}</span>
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
