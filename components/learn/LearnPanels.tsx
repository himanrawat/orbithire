// Server-rendered panels for the Learn page: path cards, the study library and the
// skill-gap card.

import Link from "next/link";
import { ArrowRight, BookOpen, Clock, ExternalLink, FileText, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, SectionHeader } from "@/components/app/blocks";
import { STAGE_INFO, isCareerStage } from "@/lib/onboarding/stages";
import { libraryHref, type LibraryItem, type PathSummary, type ResourceLink, type SkillGap } from "@/lib/learn/types";

function stageLabel(stage: string | null) {
	return stage && isCareerStage(stage) ? STAGE_INFO[stage].label : null;
}

function progressLabel(path: PathSummary) {
	if (path.doneCount === 0) return `${path.lessonCount} lessons`;
	if (path.doneCount >= path.lessonCount) return "Completed";
	return `${path.doneCount} of ${path.lessonCount} done`;
}

function PathCard({ path, locked }: Readonly<{ path: PathSummary; locked: boolean }>) {
	const stage = stageLabel(path.stage);
	const percent = path.lessonCount > 0 ? Math.round((path.doneCount / path.lessonCount) * 100) : 0;
	return (
		<li>
			<Link
				href={`/learn/paths/${path.slug}`}
				className="group flex h-full flex-col rounded-[var(--radius-md)] border bg-card p-5 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<div className="flex items-center gap-2">
					<Badge variant="learn">{progressLabel(path)}</Badge>
					{stage && <Badge variant="outline">{stage}</Badge>}
					{locked && <Badge variant="outline">Pro</Badge>}
				</div>
				<h3 className="mt-3 font-display text-lg font-[650] leading-6">{path.title}</h3>
				<p className="mt-1 flex-1 text-sm leading-5 text-muted-foreground">{path.summary}</p>
				<div
					className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"
					role="progressbar"
					aria-label={`${path.title} progress`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
				>
					<div className="h-full rounded-full bg-[var(--kind-learn)]" style={{ width: `${percent}%` }} />
				</div>
				<p className="mt-3 flex items-center justify-between text-[13px] text-muted-foreground">
					<span className="inline-flex items-center gap-1">
						<Clock className="h-3.5 w-3.5" aria-hidden="true" />
						About {path.totalMinutes} min total
					</span>
					<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
				</p>
			</Link>
		</li>
	);
}

/** `locked`: path ids the plan doesn't open (shown with a Pro badge; the path page explains). */
export function PathsGrid({ paths, locked }: Readonly<{ paths: PathSummary[]; locked?: ReadonlySet<string> }>) {
	if (paths.length === 0) {
		return <EmptyState icon={<BookOpen />} title="Paths are on their way" description="Learning paths will show up here soon." />;
	}
	return (
		<ul className="grid gap-4 sm:grid-cols-2">
			{paths.map((path) => (
				<PathCard key={path.id} path={path} locked={locked?.has(path.id) ?? false} />
			))}
		</ul>
	);
}

function LibraryRow({ item }: Readonly<{ item: LibraryItem }>) {
	const href = libraryHref(item);
	const external = !href.startsWith("/");
	const Icon = external ? ExternalLink : FileText;
	return (
		<li className="flex items-start gap-3 rounded-[var(--radius-md)] border bg-card p-4">
			<Icon className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
			<div className="min-w-0">
				{external ? (
					<a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
						{item.title}
						<span className="sr-only"> (opens in a new tab)</span>
					</a>
				) : (
					<Link href={href} className="font-semibold hover:underline">
						{item.title}
					</Link>
				)}
				<p className="mt-0.5 text-[13px] text-muted-foreground">
					{external ? item.source_name : "Original guide"}
				</p>
			</div>
		</li>
	);
}

export function LibraryList({ items }: Readonly<{ items: LibraryItem[] }>) {
	if (items.length === 0) {
		return <EmptyState title="The library is empty" description="Guides and links will show up here soon." />;
	}
	const guides = items.filter((item) => item.kind === "guide");
	const links = items.filter((item) => item.kind === "link");
	return (
		<div className="space-y-8">
			<section aria-labelledby="library-guides">
				<SectionHeader title={<span id="library-guides">Short guides</span>} description="Original, five-minute reads." />
				<ul className="grid gap-3 sm:grid-cols-2">
					{guides.map((item) => (
						<LibraryRow key={item.id} item={item} />
					))}
				</ul>
			</section>
			<section aria-labelledby="library-links">
				<SectionHeader
					title={<span id="library-links">Recommended elsewhere</span>}
					description="Free, well-kept resources, credited to their authors."
				/>
				<ul className="grid gap-3 sm:grid-cols-2">
					{links.map((item) => (
						<LibraryRow key={item.id} item={item} />
					))}
				</ul>
			</section>
		</div>
	);
}

function ResourceAnchor({ resource }: Readonly<{ resource: ResourceLink }>) {
	const className = "text-[var(--info)] underline-offset-2 hover:underline";
	if (resource.external) {
		return (
			<a href={resource.href} target="_blank" rel="noopener noreferrer" className={className}>
				{resource.title}
				<span className="sr-only"> (opens in a new tab)</span>
			</a>
		);
	}
	return (
		<Link href={resource.href} className={className}>
			{resource.title}
		</Link>
	);
}

function GapRow({ gap }: Readonly<{ gap: SkillGap }>) {
	return (
		<li className="py-3 first:pt-0 last:pb-0">
			<div className="flex items-baseline justify-between gap-3">
				<p className="font-semibold">{gap.label}</p>
				<p className="flex-none text-[13px] text-muted-foreground">
					In {gap.jobCount} {gap.jobCount === 1 ? "match" : "matches"}
				</p>
			</div>
			{gap.resources.length > 0 ? (
				<ul className="mt-1 space-y-0.5 text-sm">
					{gap.resources.map((resource) => (
						<li key={resource.href}>
							<ResourceAnchor resource={resource} />
						</li>
					))}
				</ul>
			) : (
				<p className="mt-1 text-sm text-muted-foreground">No lesson yet. Log what you find.</p>
			)}
		</li>
	);
}

export function SkillGapCard({ gaps, hasMatches }: Readonly<{ gaps: SkillGap[]; hasMatches: boolean }>) {
	return (
		<Card>
			<CardContent className="pt-6">
				<SectionHeader
					icon={<Target />}
					title="Skills your matches ask for"
					description="From your top job matches, minus the skills on your profile and resume."
				/>
				<SkillGapBody gaps={gaps} hasMatches={hasMatches} />
			</CardContent>
		</Card>
	);
}

function SkillGapBody({ gaps, hasMatches }: Readonly<{ gaps: SkillGap[]; hasMatches: boolean }>) {
	if (!hasMatches) {
		return (
			<p className="text-sm text-muted-foreground">
				Once your <Link href="/jobs" className="text-[var(--info)] hover:underline">Job Inbox</Link> has matches,
				we&apos;ll show the skills they ask for here.
			</p>
		);
	}
	if (gaps.length === 0) {
		return <p className="text-sm text-muted-foreground">Your profile already covers what your top matches ask for.</p>;
	}
	return (
		<ol className="divide-y">
			{gaps.map((gap) => (
				<GapRow key={gap.skillId} gap={gap} />
			))}
		</ol>
	);
}
