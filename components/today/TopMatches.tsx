import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/blocks";
import type { TodayMatch } from "@/lib/today/types";

function matchMeta(match: TodayMatch): string {
	return [match.company, match.location, match.isRemote ? "Remote" : null].filter(Boolean).join(" · ");
}

function ScoreBadge({ score }: Readonly<{ score: number | null }>) {
	if (score === null) {
		return <span className="text-xs text-muted-foreground">Not scored yet</span>;
	}
	return (
		<span
			className="rounded-full bg-[var(--kind-jobs-soft)] px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-[var(--kind-jobs)]"
			aria-label={`Match score ${score} out of 100`}
		>
			{score}
		</span>
	);
}

/** Top 3 new matches from the Job Inbox, with their scores. */
export function TopMatches({ matches }: Readonly<{ matches: readonly TodayMatch[] }>) {
	return (
		<section aria-labelledby="matches-heading" className="rounded-[var(--radius-md)] border bg-card p-5">
			<SectionHeader
				icon={<Briefcase aria-hidden="true" />}
				title={<span id="matches-heading">New matches</span>}
				description="The best new roles in your Job Inbox."
				action={
					<Button variant="outline" size="sm" asChild>
						<Link href="/jobs">
							Job Inbox
							<ChevronRight className="h-4 w-4" aria-hidden="true" />
						</Link>
					</Button>
				}
			/>
			{matches.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No new matches yet. New roles arrive each morning once your job search is set up.
				</p>
			) : (
				<ul className="space-y-2">
					{matches.map((m) => (
						<li key={m.id}>
							<Link
								href={`/jobs/${m.id}`}
								className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border bg-background/50 p-3 transition-colors hover:bg-muted/50"
							>
								<div className="min-w-0">
									<p className="truncate font-medium">{m.title}</p>
									<p className="truncate text-sm text-muted-foreground">{matchMeta(m)}</p>
								</div>
								<ScoreBadge score={m.score} />
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
