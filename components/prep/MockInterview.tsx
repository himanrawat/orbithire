"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiLabel } from "@/components/AiLabel";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { gateMessage } from "@/lib/billing/gates";
import type { PracticeAttempt, PrepQuestion } from "@/lib/prep/constants";
import { MOCK_DURATION_MINUTES, formatClock, summarizeMock, type MockSummary } from "@/lib/prep/mock";
import { errorMessage, startMock } from "./api";
import { PracticeSession } from "./PracticeSession";
import { useCountdown } from "./useCountdown";

type Running = { mockId: string; questions: PrepQuestion[]; endsAt: number };

function SummaryList({ title, items }: Readonly<{ title: string; items: readonly string[] }>) {
	if (items.length === 0) return null;
	return (
		<div>
			<h3 className="text-sm font-semibold">{title}</h3>
			<ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-6">
				{items.map((item, i) => (
					<li key={`${i}-${item}`}>{item}</li>
				))}
			</ul>
		</div>
	);
}

function MockSummaryView({ summary, timedOut }: Readonly<{ summary: MockSummary; timedOut: boolean }>) {
	return (
		<section aria-labelledby="mock-summary-heading" className="space-y-4 rounded-[var(--radius-md)] border bg-card p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="mock-summary-heading" className="font-display text-xl font-[680]">
					Mock summary
				</h2>
				{summary.strengths.length > 0 && <AiLabel label="AI feedback" />}
			</div>
			<p className="text-sm text-muted-foreground">
				{timedOut ? "Time's up. " : ""}You answered {summary.answered} of {summary.total} questions.
			</p>
			<SummaryList title="What went well" items={summary.strengths} />
			<SummaryList title="What to work on" items={summary.gaps} />
			<SummaryList title="Read next" items={summary.nextReads} />
			<div className="flex flex-wrap gap-2">
				<Button variant="cap" asChild>
					<Link href="/prep">Back to prep</Link>
				</Button>
			</div>
		</section>
	);
}

function MockIntro({ onStart, starting, error }: Readonly<{ onStart: () => void; starting: boolean; error: string | null }>) {
	return (
		<section className="space-y-4 rounded-[var(--radius-md)] border bg-card p-5">
			<p className="text-sm leading-6">
				You&apos;ll get 3–4 questions in interview order: a warm-up, a technical question, and a design or leadership
				question. The clock runs for {MOCK_DURATION_MINUTES} minutes. Feedback comes after each answer, and a summary at
				the end.
			</p>
			<Button type="button" variant="cap" disabled={starting} onClick={onStart}>
				{starting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
				Start the clock
			</Button>
			{error && <output className="block text-sm text-[var(--danger)]">{error}</output>}
		</section>
	);
}

function nextLabel(index: number, total: number): string {
	return index + 1 < total ? "Next question" : "Finish and see summary";
}

/** Timed 30-minute mock: 3-4 questions, then a summary. Pro (`allowed` false shows an upgrade note). */
export function MockInterview({ allowed = true }: Readonly<{ allowed?: boolean }>) {
	const [running, setRunning] = useState<Running | null>(null);
	const [index, setIndex] = useState(0);
	const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
	const [finished, setFinished] = useState(false);
	const [starting, setStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const remaining = useCountdown(running && !finished ? running.endsAt : null);
	const timedOut = remaining === 0;

	useEffect(() => {
		if (timedOut) setFinished(true);
	}, [timedOut]);

	async function begin() {
		setStarting(true);
		try {
			const mock = await startMock();
			setRunning({
				mockId: mock.mockId,
				questions: mock.questions,
				endsAt: Date.now() + mock.durationMinutes * 60_000,
			});
		} catch (e) {
			setError(errorMessage(e, "Could not start a mock interview"));
		} finally {
			setStarting(false);
		}
	}

	if (!allowed) {
		return <UpgradePrompt title="Mock interviews are part of Pro" message={gateMessage("mock_interviews")} />;
	}
	if (!running) return <MockIntro onStart={() => void begin()} starting={starting} error={error} />;
	if (finished || index >= running.questions.length) {
		return <MockSummaryView summary={summarizeMock(running.questions.length, attempts)} timedOut={timedOut} />;
	}

	const question = running.questions[index];
	const advance = () => {
		if (index + 1 >= running.questions.length) setFinished(true);
		else setIndex(index + 1);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border bg-card px-4 py-3">
				<p className="text-sm font-semibold">
					Question {index + 1} of {running.questions.length}
				</p>
				<p className="flex items-center gap-2 font-mono text-lg tabular-nums">
					<Timer className="h-4 w-4" aria-hidden="true" />
					<span className="sr-only">Time left: </span>
					{formatClock(remaining ?? MOCK_DURATION_MINUTES * 60)}
				</p>
				<Button type="button" variant="ghost" size="sm" onClick={() => setFinished(true)}>
					End mock
				</Button>
			</div>
			<PracticeSession
				key={question.id}
				question={question}
				mockId={running.mockId}
				onAttempt={(a) => setAttempts((list) => [...list, a])}
				reviewAction={
					<Button type="button" variant="cap" onClick={advance}>
						{nextLabel(index, running.questions.length)}
					</Button>
				}
			/>
		</div>
	);
}
