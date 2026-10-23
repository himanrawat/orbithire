import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { LearnTabs } from "@/components/learn/LearnTabs";
import { LearningLog } from "@/components/learn/LearningLog";
import { LibraryList, PathsGrid, SkillGapCard } from "@/components/learn/LearnPanels";
import { isPathUnlocked } from "@/lib/learn/access";
import { loadPathAccess } from "@/lib/learn/server";
import { parseLearnTab } from "@/lib/learn/tabs";
import type { PathSummary } from "@/lib/learn/types";
import { loadLearnPage, requirePageUser } from "./data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Learn" };

function UnavailableNotice() {
	return (
		<output className="mb-6 block rounded-[var(--radius-md)] border bg-card p-4 text-sm text-muted-foreground">
			Learn isn&apos;t set up on this server yet. Please check back soon.
		</output>
	);
}

async function lockedPathIds(supabase: Parameters<typeof loadPathAccess>[0], userId: string, paths: PathSummary[]) {
	const access = await loadPathAccess(supabase, userId).catch(() => null);
	if (!access) return new Set<string>();
	return new Set(paths.filter((path) => !isPathUnlocked(access, path.id)).map((path) => path.id));
}

export default async function LearnPage({
	searchParams,
}: Readonly<{ searchParams: Record<string, string | string[] | undefined> }>) {
	const { supabase, userId } = await requirePageUser();
	const data = await loadLearnPage(supabase, userId);
	const locked = await lockedPathIds(supabase, userId, data.paths);

	return (
		<div className="mx-auto w-full max-w-6xl">
			<PageHeader
				icon={<GraduationCap />}
				title="Learn"
				description="Keep a log of what you learn, work through short lessons and close the gaps your matches point to."
			/>
			{data.unavailable && <UnavailableNotice />}
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
				<LearnTabs
					initialTab={parseLearnTab(searchParams.tab)}
					panels={{
						log: <LearningLog initialEntries={data.entries} />,
						paths: <PathsGrid paths={data.paths} locked={locked} />,
						library: <LibraryList items={data.library} />,
					}}
				/>
				<aside aria-label="Skill gaps" className="xl:pt-[60px]">
					<SkillGapCard gaps={data.gaps} hasMatches={data.matchCount > 0} />
				</aside>
			</div>
		</div>
	);
}
