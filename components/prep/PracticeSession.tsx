"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InputMode, PracticeAttempt, PrepQuestion } from "@/lib/prep/constants";
import { errorMessage, submitAttempt } from "./api";
import { AnswerInput } from "./AnswerInput";
import { FeedbackCard } from "./FeedbackCard";
import { FrameworkHint } from "./FrameworkHint";
import { QuestionSource, QuestionTags } from "./QuestionMeta";
import { ThinkStep } from "./ThinkStep";
import { useVoiceInput } from "./useVoiceInput";

type Step = "think" | "answer" | "review";

const STEPS: readonly { id: Step; label: string }[] = [
	{ id: "think", label: "Think" },
	{ id: "answer", label: "Answer" },
	{ id: "review", label: "Review" },
];

function StepIndicator({ current }: Readonly<{ current: Step }>) {
	return (
		<ol className="flex gap-2 text-sm" aria-label="Practice steps">
			{STEPS.map((step, index) => (
				<li
					key={step.id}
					aria-current={step.id === current ? "step" : undefined}
					className={cn(
						"rounded-full px-3 py-1",
						step.id === current ? "bg-[var(--kind-prep-soft)] font-semibold text-[var(--kind-prep)]" : "bg-secondary text-muted-foreground"
					)}
				>
					{index + 1}. {step.label}
				</li>
			))}
		</ol>
	);
}

type PracticeSessionProps = Readonly<{
	question: PrepQuestion;
	mockId?: string;
	/** Called with the saved attempt once review starts. */
	onAttempt?: (attempt: PracticeAttempt) => void;
	/** Shown in the review step (e.g. "Next question" in a mock). */
	reviewAction?: ReactNode;
}>;

function attemptBody(question: PrepQuestion, answer: string, mode: InputMode, transcript: string, mockId?: string) {
	return {
		questionId: question.id,
		answerText: answer.trim(),
		inputMode: mode,
		...(mode === "voice" && transcript ? { transcript } : {}),
		...(mockId ? { mockId } : {}),
	};
}

function ReviewStep({
	attempt,
	feedbackError,
	onFlagged,
	action,
}: Readonly<{
	attempt: PracticeAttempt;
	feedbackError: string | null;
	onFlagged: (attempt: PracticeAttempt) => void;
	action?: ReactNode;
}>) {
	return (
		<div className="space-y-4">
			<details className="rounded-[var(--radius-md)] border bg-card p-4">
				<summary className="cursor-pointer text-sm font-semibold">Your answer</summary>
				<p className="mt-2 whitespace-pre-wrap text-sm leading-6">{attempt.answerText}</p>
			</details>
			<FeedbackCard attempt={attempt} feedbackError={feedbackError} onFlagged={onFlagged} />
			{action}
		</div>
	);
}

/** Think → answer → review for one question. */
export function PracticeSession({ question, mockId, onAttempt, reviewAction }: PracticeSessionProps) {
	const [step, setStep] = useState<Step>("think");
	const [answer, setAnswer] = useState("");
	const [mode, setMode] = useState<InputMode>("text");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
	const [feedbackError, setFeedbackError] = useState<string | null>(null);
	const voice = useVoiceInput();

	async function submit() {
		voice.stop();
		setSubmitting(true);
		setError(null);
		try {
			const res = await submitAttempt(attemptBody(question, answer, mode, voice.transcript, mockId));
			setAttempt(res.attempt);
			setFeedbackError(res.feedbackError);
			setStep("review");
			onAttempt?.(res.attempt);
		} catch (e) {
			setError(errorMessage(e, "Could not get feedback"));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="space-y-5">
			<StepIndicator current={step} />
			<section aria-labelledby="practice-question" className="rounded-[var(--radius-md)] border bg-card p-5">
				<QuestionTags question={question} />
				<h2 id="practice-question" className="mt-3 font-display text-xl font-[680] leading-7">
					{question.prompt}
				</h2>
				<div className="mt-3">
					<QuestionSource question={question} />
				</div>
			</section>
			<FrameworkHint question={question} />
			{step === "think" && <ThinkStep onReady={() => setStep("answer")} />}
			{step === "answer" && (
				<div className="space-y-3">
					<AnswerInput
						value={answer}
						onChange={setAnswer}
						mode={mode}
						onModeChange={setMode}
						voice={voice}
						disabled={submitting}
					/>
					<div className="flex flex-wrap items-center gap-3">
						<Button type="button" variant="cap" disabled={submitting || !answer.trim()} onClick={() => void submit()}>
							{submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
							Submit for feedback
						</Button>
						{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
					</div>
				</div>
			)}
			{step === "review" && attempt && (
				<ReviewStep attempt={attempt} feedbackError={feedbackError} onFlagged={setAttempt} action={reviewAction} />
			)}
		</div>
	);
}
