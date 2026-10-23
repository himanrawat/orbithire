"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader, Skeleton } from "@/components/app/blocks";
import type { InterviewCard } from "@/lib/prep/constants";
import { AddInterviewForm } from "./AddInterviewForm";
import { InterviewCardView } from "./InterviewCardView";
import type { InterviewsState } from "./useInterviews";

type InterviewsSectionProps = Readonly<{
	state: InterviewsState;
	highlightCompanyId: string | null;
	onPractice: (card: InterviewCard) => void;
}>;

function InterviewList({ state, highlightCompanyId, onPractice }: InterviewsSectionProps) {
	if (state.loading) return <Skeleton className="h-40" />;
	if (state.interviews.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No interviews yet. Add one to get a checklist and a nudge on Today three days before.
			</p>
		);
	}
	return (
		<ul className="grid gap-3 md:grid-cols-2">
			{state.interviews.map((card) => (
				<li key={card.id}>
					<InterviewCardView
						card={card}
						highlighted={card.companyId === highlightCompanyId}
						onToggle={state.toggle}
						onRemove={state.remove}
						onPractice={onPractice}
					/>
				</li>
			))}
		</ul>
	);
}

/** Upcoming interviews, each linked to an application. */
export function InterviewsSection(props: InterviewsSectionProps) {
	const [adding, setAdding] = useState(false);
	const { state } = props;
	return (
		<section aria-labelledby="interviews-heading">
			<SectionHeader
				title={<span id="interviews-heading">Upcoming interviews</span>}
				description="Date, round and a checklist for each interview."
				action={
					!adding && (
						<Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
							<CalendarPlus className="h-4 w-4" aria-hidden="true" />
							Add interview
						</Button>
					)
				}
			/>
			{adding && (
				<div className="mb-4">
					<AddInterviewForm companies={state.companies} onAdd={state.add} onDone={() => setAdding(false)} />
				</div>
			)}
			{state.error && <output className="mb-3 block text-sm text-[var(--danger)]">{state.error}</output>}
			<InterviewList {...props} />
		</section>
	);
}
