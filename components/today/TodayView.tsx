"use client";

import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/app/blocks";
import type { TodayData } from "@/lib/today/types";
import { ComingUp } from "./ComingUp";
import { DailyPlanList } from "./DailyPlanList";
import { LearningLogInput } from "./LearningLogInput";
import { NextStepCard } from "./NextStepCard";
import { TopMatches } from "./TopMatches";
import { WeeklyFocusCard } from "./WeeklyFocusCard";
import { useToday, type TodayState } from "./useToday";

function greeting(firstName: string | null | undefined): string {
	return firstName ? `Today, ${firstName}` : "Today";
}

function HeaderActions() {
	return (
		<>
			<Button variant="outline" asChild>
				<Link href="/generate">
					<Sparkles className="h-4 w-4" aria-hidden="true" />
					Generate resume
				</Link>
			</Button>
			<Button variant="outline" asChild>
				<Link href="/companies/new">
					<Plus className="h-4 w-4" aria-hidden="true" />
					New application
				</Link>
			</Button>
		</>
	);
}

function LoadingState() {
	return (
		<output aria-live="polite" aria-busy="true" className="grid gap-4">
			<span className="sr-only">Loading your day…</span>
			<Skeleton className="h-40 w-full" />
			<Skeleton className="h-56 w-full" />
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

function TodayContent({ data, state }: Readonly<{ data: TodayData; state: TodayState }>) {
	return (
		<div className="grid gap-6 lg:grid-cols-3">
			<div className="space-y-6 lg:col-span-2">
				<NextStepCard
					step={data.nextStep}
					dismissed={data.nextStepDismissed}
					onDismiss={state.dismissNextStep}
				/>
				{state.actionError && (
					<output aria-live="polite" className="block text-sm text-destructive">
						{state.actionError}
					</output>
				)}
				<DailyPlanList
					plan={data.plan}
					regenerating={state.regenerating}
					onToggle={state.toggleItem}
					onRegenerate={state.regenerate}
				/>
				<TopMatches matches={data.matches} />
			</div>
			<div className="space-y-6">
				<ComingUp items={data.comingUp} timeZone={data.timeZone} />
				{data.weeklyFocus && <WeeklyFocusCard focus={data.weeklyFocus} />}
				{data.learningLogAvailable && <LearningLogInput />}
			</div>
		</div>
	);
}

function TodayBody({ state }: Readonly<{ state: TodayState }>) {
	if (state.data) return <TodayContent data={state.data} state={state} />;
	if (state.loading) return <LoadingState />;
	return <ErrorState message={state.error ?? "Could not load Today"} onRetry={state.reload} />;
}

/** The Today home: next step, daily plan, new matches, coming up. */
export function TodayView() {
	const state = useToday();
	return (
		<div className="mb-10">
			<PageHeader
				title={greeting(state.data?.firstName)}
				description="One clear next step, a short plan and what's coming up."
				actions={<HeaderActions />}
			/>
			<TodayBody state={state} />
		</div>
	);
}
