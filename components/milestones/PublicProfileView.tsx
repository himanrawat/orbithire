// What a visitor sees at /u/[handle]: name, headline and the public milestones by year.
// Pure and hook-free, so the public page (server) and "Preview as public" (client) share it.
// Takes only PublicProfile fields: there is no way to pass open_to_roles or email here.

import { Badge } from "@/components/ui/badge";
import { MilestoneMark } from "@/components/app/blocks";
import {
	MILESTONE_KIND_BADGES,
	MILESTONE_KIND_LABELS,
	displayName,
	formatMilestoneDate,
	groupByYear,
	type PublicLearningEntry,
	type PublicMilestone,
	type PublicProfile,
} from "@/lib/milestones/model";

function MilestoneItem({ milestone }: Readonly<{ milestone: PublicMilestone }>) {
	return (
		<li className="relative border-l border-border pb-6 pl-6 last:pb-0">
			<span aria-hidden="true" className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--cap)]" />
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={MILESTONE_KIND_BADGES[milestone.kind]}>{MILESTONE_KIND_LABELS[milestone.kind]}</Badge>
				<time dateTime={milestone.happened_on} className="font-mono text-xs text-muted-foreground">
					{formatMilestoneDate(milestone.happened_on)}
				</time>
			</div>
			<h3 className="mt-2 text-base font-semibold leading-6">{milestone.title}</h3>
			{milestone.description && (
				<p className="mt-1 max-w-[68ch] whitespace-pre-line text-sm leading-6 text-muted-foreground">
					{milestone.description}
				</p>
			)}
		</li>
	);
}

function Timeline({ milestones }: Readonly<{ milestones: readonly PublicMilestone[] }>) {
	if (milestones.length === 0) {
		return <p className="text-sm text-muted-foreground">No public milestones yet.</p>;
	}
	return (
		<div className="grid gap-10">
			{groupByYear(milestones).map(([year, items]) => (
				<section key={year} aria-labelledby={`year-${year}`}>
					<h2 id={`year-${year}`} className="mb-4 font-mono text-sm font-medium text-muted-foreground">
						{year}
					</h2>
					<ol className="ml-1">
						{items.map((milestone) => (
							<MilestoneItem key={milestone.id} milestone={milestone} />
						))}
					</ol>
				</section>
			))}
		</div>
	);
}

function formatDay(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function LearningTitle({ entry }: Readonly<{ entry: PublicLearningEntry }>) {
	if (!entry.url) return <>{entry.title}</>;
	return (
		<a href={entry.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="underline underline-offset-2">
			{entry.title}
		</a>
	);
}

function LearningList({ entries }: Readonly<{ entries: readonly PublicLearningEntry[] }>) {
	if (entries.length === 0) return null;
	return (
		<section aria-labelledby="public-learning" className="grid gap-4">
			<h2 id="public-learning" className="font-display text-xl font-[650]">
				Recent learning
			</h2>
			<ul className="grid gap-3">
				{entries.map((entry) => (
					<li key={entry.id} className="rounded-[var(--radius-md)] border border-border p-4">
						<p className="font-semibold leading-6">
							<LearningTitle entry={entry} />
						</p>
						{entry.note && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{entry.note}</p>}
						<p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<time dateTime={entry.created_at}>{formatDay(entry.created_at)}</time>
							{entry.tags.map((tag) => (
								<Badge key={tag} variant="learn">
									{tag}
								</Badge>
							))}
						</p>
					</li>
				))}
			</ul>
		</section>
	);
}

export function PublicProfileView({
	profile,
	headingLevel = 1,
}: Readonly<{
	profile: PublicProfile;
	/** 1 on the public page; 2 inside the owner's preview, which already has a page title */
	headingLevel?: 1 | 2;
}>) {
	const Heading = headingLevel === 1 ? "h1" : "h2";
	return (
		<article aria-labelledby="public-profile-name" className="grid gap-10">
			<header className="flex items-start gap-4">
				<MilestoneMark size={44} className="mt-1 flex-none" />
				<div className="min-w-0">
					<Heading
						id="public-profile-name"
						className="font-display text-[32px] font-[680] leading-[38px] tracking-[-0.02em] md:text-[44px] md:leading-[48px]"
					>
						{displayName(profile)}
					</Heading>
					{profile.headline && <p className="mt-2 max-w-[60ch] text-[17px] leading-7 text-muted-foreground">{profile.headline}</p>}
				</div>
			</header>
			<Timeline milestones={profile.milestones} />
			<LearningList entries={profile.learning} />
		</article>
	);
}
