"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InterviewCard } from "@/lib/prep/constants";
import { EMPTY_FILTERS, filtersForInterview, type FilterState } from "@/lib/prep/filters";
import { InterviewsSection } from "./InterviewsSection";
import { QuestionBank } from "./QuestionBank";
import { ReportQuestionForm } from "./ReportQuestionForm";
import { useInterviews } from "./useInterviews";

function scrollToBank() {
	document.getElementById("question-bank")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function MockCallout() {
	return (
		<section
			aria-labelledby="mock-heading"
			className="flex flex-col gap-3 rounded-[var(--radius-md)] border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<h2 id="mock-heading" className="font-display text-base font-[650]">
					Timed mock interview
				</h2>
				<p className="text-sm text-muted-foreground">30 minutes, 3–4 mixed questions, then a summary of what to work on.</p>
			</div>
			<Button variant="cap" asChild>
				<Link href="/prep/mock">
					<Timer className="h-4 w-4" aria-hidden="true" />
					Start a mock
				</Link>
			</Button>
		</section>
	);
}

/** /prep: interviews, the question bank, the mock and the report form. */
export function PrepView() {
	const params = useSearchParams();
	const highlightCompanyId = params.get("company");
	const interviews = useInterviews();
	const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
	const appliedFromLink = useRef(false);

	// Arriving from Today (?company=...): match the bank to that interview's round once.
	useEffect(() => {
		if (appliedFromLink.current || !highlightCompanyId) return;
		const card = interviews.interviews.find((c) => c.companyId === highlightCompanyId);
		if (!card) return;
		appliedFromLink.current = true;
		setFilters(filtersForInterview(card));
	}, [highlightCompanyId, interviews.interviews]);

	function practiceFor(card: InterviewCard) {
		setFilters(filtersForInterview(card));
		scrollToBank();
	}

	return (
		<div className="space-y-8">
			<InterviewsSection state={interviews} highlightCompanyId={highlightCompanyId} onPractice={practiceFor} />
			<MockCallout />
			<QuestionBank filters={filters} onFiltersChange={setFilters} />
			<ReportQuestionForm />
		</div>
	);
}
