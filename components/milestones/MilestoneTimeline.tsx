"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/blocks";
import {
	MILESTONE_KIND_BADGES,
	MILESTONE_KIND_LABELS,
	formatMilestoneDate,
	groupByYear,
	type Milestone,
} from "@/lib/milestones/model";
import type { MilestoneInput } from "./api";
import { MilestoneForm } from "./MilestoneForm";

export type TimelineActions = Readonly<{
	onUpdate: (id: string, input: Partial<MilestoneInput>) => Promise<string | null>;
	onDelete: (id: string) => Promise<string | null>;
}>;

function toInput(milestone: Milestone): MilestoneInput {
	const { kind, title, description, happened_on, visibility } = milestone;
	return { kind, title, description, happened_on, visibility };
}

function VisibilityBadge({ milestone }: Readonly<{ milestone: Milestone }>) {
	if (milestone.visibility === "public") return <Badge variant="success">Public</Badge>;
	return <Badge variant="outline">Only me</Badge>;
}

function SourceNote({ milestone }: Readonly<{ milestone: Milestone }>) {
	if (milestone.source === "manual") return null;
	return <span className="text-xs text-muted-foreground">From your activity</span>;
}

function MilestoneRow({ milestone, actions }: Readonly<{ milestone: Milestone; actions: TimelineActions }>) {
	const [editing, setEditing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const isPublic = milestone.visibility === "public";

	const run = async (work: () => Promise<string | null>) => {
		setBusy(true);
		setError(null);
		const failure = await work();
		setBusy(false);
		setError(failure);
	};

	const toggleVisibility = () =>
		run(() => actions.onUpdate(milestone.id, { visibility: isPublic ? "private" : "public" }));

	const remove = () => {
		if (!window.confirm(`Delete "${milestone.title}"? This can't be undone.`)) return;
		void run(() => actions.onDelete(milestone.id));
	};

	if (editing) {
		return (
			<li className="rounded-[var(--radius-md)] border border-border bg-card p-4">
				<MilestoneForm
					idPrefix={`edit-${milestone.id}`}
					mode="edit"
					initial={toInput(milestone)}
					onCancel={() => setEditing(false)}
					onSubmit={async (input) => {
						const failure = await actions.onUpdate(milestone.id, input);
						if (!failure) setEditing(false);
						return failure;
					}}
				/>
			</li>
		);
	}

	return (
		<li className="rounded-[var(--radius-md)] border border-border bg-card p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant={MILESTONE_KIND_BADGES[milestone.kind]}>{MILESTONE_KIND_LABELS[milestone.kind]}</Badge>
						<VisibilityBadge milestone={milestone} />
						<time dateTime={milestone.happened_on} className="font-mono text-xs text-muted-foreground">
							{formatMilestoneDate(milestone.happened_on)}
						</time>
						<SourceNote milestone={milestone} />
					</div>
					<h3 className="mt-2 font-semibold leading-6">{milestone.title}</h3>
					{milestone.description && (
						<p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{milestone.description}</p>
					)}
				</div>
				<div className="flex flex-none items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={busy}
						aria-pressed={isPublic}
						aria-label={isPublic ? `Make "${milestone.title}" private` : `Make "${milestone.title}" public`}
						onClick={() => void toggleVisibility()}
					>
						{isPublic ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
						{isPublic ? "Make private" : "Make public"}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						disabled={busy}
						aria-label={`Edit "${milestone.title}"`}
						onClick={() => setEditing(true)}
					>
						<Pencil className="h-4 w-4" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						disabled={busy}
						aria-label={`Delete "${milestone.title}"`}
						onClick={remove}
					>
						<Trash2 className="h-4 w-4" aria-hidden="true" />
					</Button>
				</div>
			</div>
			{error && (
				<output aria-live="polite" className="mt-2 block text-sm text-destructive">
					{error}
				</output>
			)}
		</li>
	);
}

export function MilestoneTimeline({
	milestones,
	actions,
}: Readonly<{ milestones: readonly Milestone[]; actions: TimelineActions }>) {
	if (milestones.length === 0) {
		return (
			<EmptyState
				title="Your timeline starts here"
				description="Add a new job, a promotion, a course you finished or a talk you gave. Everything is private until you make it public."
			/>
		);
	}
	return (
		<div className="grid gap-8">
			{groupByYear(milestones).map(([year, items]) => (
				<section key={year} aria-labelledby={`owner-year-${year}`}>
					<h2 id={`owner-year-${year}`} className="mb-3 font-mono text-sm font-medium text-muted-foreground">
						{year}
					</h2>
					<ul className="grid gap-3">
						{items.map((milestone) => (
							<MilestoneRow key={milestone.id} milestone={milestone} actions={actions} />
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
