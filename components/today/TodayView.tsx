"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import { focusProgress } from "@/lib/today/focus";
import type { TodayData } from "@/lib/today/types";
import { activeDayCount, greetingFor } from "@/lib/today/week";
import { CommunityPreview } from "./CommunityPreview";
import { ComingUp } from "./ComingUp";
import { DailyPlanList } from "./DailyPlanList";
import { NextStepCard } from "./NextStepCard";
import { PeopleCard } from "./PeopleCard";
import { TopMatches } from "./TopMatches";
import { WeekCard } from "./WeekCard";
import { useToday, type TodayState } from "./useToday";

function LoadingState() {
	return (
		<output aria-live="polite" aria-busy="true" className="grid gap-4">
			<span className="sr-only">Loading your day…</span>
			<Skeleton className="h-10 w-64" />
			<Skeleton className="h-40 w-full" />
		</output>
	);
}

function ErrorState({ message, onRetry }: Readonly<{ message: string; onRetry: () => Promise<void> }>) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border bg-card p-5">
			<p className="text-sm text-muted-foreground">{message}</p>
			<Button type="button" variant="outline" size="sm" onClick={() => void onRetry()}>
				Try again
			</Button>
		</div>
	);
}

function planLabel(data: TodayData): string | null {
	const items = data.plan?.items ?? [];
	if (items.length === 0) return null;
	return `${items.filter((i) => i.done).length} of ${items.length} done`;
}

function statusParts(data: TodayData): string[] {
	const parts: string[] = [];
	const days = activeDayCount(data.week);
	if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"} active this week`);
	if (data.weeklyFocus && data.weeklyFocus.minutes > 0) parts.push(`${focusProgress(data.weeklyFocus).label} of focus`);
	return parts;
}

/** Greeting and one status line; the plan count opens the full plan. */
function Header({
	data,
	planOpen,
	onTogglePlan,
}: Readonly<{ data: TodayData; planOpen: boolean; onTogglePlan: () => void }>) {
	const plan = planLabel(data);
	const parts = statusParts(data);
	return (
		<header className="space-y-1.5">
			<h1 className="font-display text-[28px] font-[650] leading-9 tracking-[-0.02em] md:text-[32px]">
				{greetingFor(new Date(), data.timeZone, data.firstName)}
			</h1>
			<p className="flex flex-wrap items-center gap-x-1.5 text-[15px] text-muted-foreground">
				{plan && (
					<button
						type="button"
						aria-expanded={planOpen}
						aria-controls="plan-panel"
						onClick={onTogglePlan}
						className="inline-flex min-h-11 items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
					>
						{plan}
						<ChevronDown className={cn("h-4 w-4 transition-transform", planOpen && "rotate-180")} aria-hidden="true" />
					</button>
				)}
				{parts.map((part, i) => (
					<span key={part}>
						{(plan || i > 0) && <span aria-hidden="true">· </span>}
						{part}
					</span>
				))}
			</p>
		</header>
	);
}

function TodayContent({ data, state }: Readonly<{ data: TodayData; state: TodayState }>) {
	const [planOpen, setPlanOpen] = useState(false);
	return (
		<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
			<div className="min-w-0 max-w-[720px] space-y-5">
				<Header data={data} planOpen={planOpen} onTogglePlan={() => setPlanOpen((open) => !open)} />
				<NextStepCard step={data.nextStep} dismissed={data.nextStepDismissed} onDismiss={state.dismissNextStep} />
				{state.actionError && (
					<output aria-live="polite" className="block text-sm text-destructive">
						{state.actionError}
					</output>
				)}
				<div id="plan-panel" hidden={!planOpen}>
					<DailyPlanList
						plan={data.plan}
						regenerating={state.regenerating}
						onToggle={state.toggleItem}
						onRegenerate={state.regenerate}
					/>
				</div>
				<CommunityPreview posts={data.community?.posts ?? null} />
			</div>
			<aside aria-label="Your week" className="space-y-4">
				<WeekCard week={data.week} />
				<ComingUp items={data.comingUp} timeZone={data.timeZone} />
				<TopMatches matches={data.matches} />
				{data.community && <PeopleCard people={data.community.people} />}
			</aside>
		</div>
	);
}

function TodayBody({ state }: Readonly<{ state: TodayState }>) {
	if (state.data) return <TodayContent data={state.data} state={state} />;
	if (state.loading) return <LoadingState />;
	return <ErrorState message={state.error ?? "Could not load Today"} onRetry={state.reload} />;
}

/** The Today home: one next step, then the week and the community, kept calm. */
export function TodayView() {
	const state = useToday();
	return <TodayBody state={state} />;
}
