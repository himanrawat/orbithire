"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Flag, ListOrdered, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton, tabClass, tabListClass } from "@/components/app/blocks";
import { publicOnly, type Milestone, type PublicLearningEntry, type PublicProfile } from "@/lib/milestones/model";
import { MilestoneForm, emptyMilestoneInput } from "./MilestoneForm";
import { MilestoneTimeline } from "./MilestoneTimeline";
import { OpenToRolesCard } from "./OpenToRolesCard";
import { PublicProfileView } from "./PublicProfileView";
import { SuggestionsPanel } from "./SuggestionsPanel";
import { useMilestones } from "./useMilestones";
import { usePublicSettings } from "./usePublicSettings";

type View = "timeline" | "preview";
type Owner = Readonly<{ fullName: string | null; headline: string | null; learning: readonly PublicLearningEntry[] }>;

const VIEWS: readonly { id: View; label: string; icon: React.ReactNode }[] = [
	{ id: "timeline", label: "Timeline", icon: <ListOrdered className="h-4 w-4" aria-hidden="true" /> },
	{ id: "preview", label: "Preview as public", icon: <Eye className="h-4 w-4" aria-hidden="true" /> },
];

/** The public view of the owner's own data: exactly the fields /u/[handle] shows. */
function toPreview(owner: Owner, handle: string | null, milestones: readonly Milestone[]): PublicProfile {
	return {
		handle: handle ?? "your-handle",
		full_name: owner.fullName,
		headline: owner.headline,
		search_indexing: false,
		milestones: publicOnly(milestones).map(({ id, kind, title, description, happened_on }) => ({
			id,
			kind,
			title,
			description,
			happened_on,
		})),
		learning: [...owner.learning],
	};
}

function PreviewNote({ enabled }: Readonly<{ enabled: boolean }>) {
	if (enabled) {
		return <p className="text-sm text-muted-foreground">This is what visitors see. Private milestones and &quot;Open to roles&quot; are left out.</p>;
	}
	return (
		<p className="text-sm text-muted-foreground">
			Your public profile is off, so nobody sees this yet. Turn it on in{" "}
			<Link href="/settings?tab=privacy" className="underline underline-offset-2">
				Settings
			</Link>
			.
		</p>
	);
}

function LoadingList() {
	return (
		<div className="grid gap-3" aria-hidden="true">
			<Skeleton className="h-20 w-full" />
			<Skeleton className="h-20 w-full" />
		</div>
	);
}

function TimelineView({ data }: Readonly<{ data: ReturnType<typeof useMilestones> }>) {
	if (data.loading) return <LoadingList />;
	if (data.loadError) return <p className="text-sm text-destructive">{data.loadError}</p>;
	return (
		<div className="grid gap-6">
			<SuggestionsPanel suggestions={data.suggestions} onAct={data.actOn} />
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Plus className="h-5 w-5" aria-hidden="true" />
						Add a milestone
					</CardTitle>
				</CardHeader>
				<CardContent>
					<MilestoneForm idPrefix="new-milestone" mode="add" initial={emptyMilestoneInput()} onSubmit={data.add} />
				</CardContent>
			</Card>
			<MilestoneTimeline milestones={data.milestones} actions={{ onUpdate: data.update, onDelete: data.remove }} />
		</div>
	);
}

export function MilestonesPageClient({ owner }: Readonly<{ owner: Owner }>) {
	const [view, setView] = useState<View>("timeline");
	const data = useMilestones();
	const { settings, save } = usePublicSettings();

	return (
		<div className="relative mx-auto max-w-4xl px-4 py-8 md:px-8">
			<PageHeader
				icon={<Flag />}
				back={{ href: "/profile", label: "Profile" }}
				title="Milestones"
				description="The moments that mark your career. Each one is private unless you make it public."
				actions={
					<Button asChild variant="outline">
						<Link href="/profile/milestones/print">
							<Printer className="h-4 w-4" aria-hidden="true" />
							One-page export
						</Link>
					</Button>
				}
			/>

			<div role="tablist" aria-label="Milestone views" className={`${tabListClass} mb-6`}>
				{VIEWS.map((item) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						id={`milestones-tab-${item.id}`}
						aria-selected={view === item.id}
						aria-controls="milestones-panel"
						onClick={() => setView(item.id)}
						className={tabClass(view === item.id)}
					>
						{item.icon}
						{item.label}
					</button>
				))}
			</div>

			<div id="milestones-panel" role="tabpanel" aria-labelledby={`milestones-tab-${view}`} className="grid gap-6">
				{view === "timeline" && <TimelineView data={data} />}
				{view === "preview" && (
					<>
						<PreviewNote enabled={settings?.public_profile_enabled === true} />
						<div className="rounded-[var(--radius-md)] border border-border bg-card p-6 md:p-10">
							<PublicProfileView
								profile={toPreview(owner, settings?.public_handle ?? null, data.milestones)}
								headingLevel={2}
							/>
						</div>
					</>
				)}
				{settings && <OpenToRolesCard settings={settings} onSave={save} />}
			</div>
		</div>
	);
}
