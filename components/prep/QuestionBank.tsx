"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader, Skeleton } from "@/components/app/blocks";
import type { PrepQuestion } from "@/lib/prep/constants";
import { filtersToQuery, type FilterState } from "@/lib/prep/filters";
import { errorMessage, fetchQuestions } from "./api";
import { QuestionFilters } from "./QuestionFilters";
import { QuestionSource, QuestionTags } from "./QuestionMeta";

function resultLabel(loading: boolean, count: number): string {
	if (loading) return "Loading questions…";
	return count === 1 ? "1 question" : `${count} questions`;
}

function QuestionItem({ question }: Readonly<{ question: PrepQuestion }>) {
	return (
		<li className="rounded-[var(--radius-md)] border bg-card p-4">
			<QuestionTags question={question} />
			<p className="mt-3 font-medium leading-6">{question.prompt}</p>
			<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
				<QuestionSource question={question} />
				<Button variant="outline" size="sm" asChild>
					<Link href={`/prep/practice/${question.id}`} aria-label={`Practice: ${question.prompt}`}>
						Practice
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
				</Button>
			</div>
		</li>
	);
}

function QuestionResults({
	loading,
	error,
	questions,
}: Readonly<{ loading: boolean; error: string | null; questions: readonly PrepQuestion[] }>) {
	if (loading) {
		return (
			<div className="space-y-3" aria-busy="true">
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
				<Skeleton className="h-28" />
			</div>
		);
	}
	if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
	if (questions.length === 0) {
		return (
			<EmptyState
				icon={<Library />}
				title="No questions match"
				description="Try fewer filters, or report a question you were asked so others can practice it."
			/>
		);
	}
	return (
		<ul className="space-y-3">
			{questions.map((q) => (
				<QuestionItem key={q.id} question={q} />
			))}
		</ul>
	);
}

type QuestionBankProps = Readonly<{
	filters: FilterState;
	onFiltersChange: (next: FilterState) => void;
}>;

/** Question bank with filters by role, topic, level, stage, company type and "Most asked". */
export function QuestionBank({ filters, onFiltersChange }: QuestionBankProps) {
	const [questions, setQuestions] = useState<PrepQuestion[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const query = filtersToQuery(filters);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		fetchQuestions(query)
			.then((list) => {
				if (cancelled) return;
				setQuestions(list);
				setError(null);
			})
			.catch((e: unknown) => {
				if (!cancelled) setError(errorMessage(e, "Could not load questions"));
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [query]);

	return (
		<section id="question-bank" aria-labelledby="question-bank-heading" className="scroll-mt-6">
			<SectionHeader
				title={<span id="question-bank-heading">Question bank</span>}
				description="Pick a question, think it through, then answer out loud or in writing."
			/>
			<QuestionFilters value={filters} onChange={onFiltersChange} />
			<output className="mt-4 block text-sm text-muted-foreground" aria-live="polite">
				{resultLabel(loading, questions.length)}
			</output>
			<div className="mt-3">
				<QuestionResults loading={loading} error={error} questions={questions} />
			</div>
		</section>
	);
}
