"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, Flag, ThumbsUp, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiLabel } from "@/components/AiLabel";
import type { PracticeAttempt, PrepFeedback } from "@/lib/prep/constants";
import { errorMessage, flagAttempt } from "./api";

const FEEDBACK_HINT =
	"Feedback drafted by AI from your answer. It can be wrong. Use it as one opinion, and report it if it misses.";

function FeedbackRow({ icon, label, children }: Readonly<{ icon: ReactNode; label: string; children: ReactNode }>) {
	return (
		<div className="flex gap-3">
			<span className="mt-0.5 flex-none [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
			<div>
				<dt className="text-sm font-semibold">{label}</dt>
				<dd className="mt-0.5 text-sm leading-6">{children}</dd>
			</div>
		</div>
	);
}

function FeedbackBody({ feedback }: Readonly<{ feedback: PrepFeedback }>) {
	return (
		<dl className="mt-4 space-y-4">
			<FeedbackRow icon={<ThumbsUp className="text-[var(--success)]" aria-hidden="true" />} label="One strength">
				{feedback.strength}
			</FeedbackRow>
			<FeedbackRow icon={<Wrench className="text-[var(--cap-ink)]" aria-hidden="true" />} label="One gap">
				{feedback.gap}
			</FeedbackRow>
			<FeedbackRow icon={<BookOpen className="text-[var(--kind-learn)]" aria-hidden="true" />} label="One next read">
				<span className="font-medium">{feedback.nextRead.title}.</span> {feedback.nextRead.detail}
			</FeedbackRow>
		</dl>
	);
}

function FlagButton({ attempt, onFlagged }: Readonly<{ attempt: PracticeAttempt; onFlagged: (a: PracticeAttempt) => void }>) {
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (attempt.flaggedWrong) {
		return <output className="text-sm text-muted-foreground">Thanks. We&apos;ll review this feedback.</output>;
	}

	async function onClick() {
		setSending(true);
		try {
			onFlagged(await flagAttempt(attempt.id));
		} catch (e) {
			setError(errorMessage(e, "Could not send your report"));
		} finally {
			setSending(false);
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => void onClick()}>
				<Flag className="h-4 w-4" aria-hidden="true" />
				This was wrong
			</Button>
			{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
		</div>
	);
}

type FeedbackCardProps = Readonly<{
	attempt: PracticeAttempt;
	feedbackError: string | null;
	onFlagged: (attempt: PracticeAttempt) => void;
}>;

/** Step 3: review. Exactly one strength, one gap and one next read, labeled as AI. */
export function FeedbackCard({ attempt, feedbackError, onFlagged }: FeedbackCardProps) {
	if (!attempt.feedback) {
		return (
			<section aria-label="Feedback" className="rounded-[var(--radius-md)] border bg-card p-5">
				<p className="text-sm text-muted-foreground">{feedbackError ?? "Your answer is saved."}</p>
			</section>
		);
	}
	return (
		<section aria-labelledby={`feedback-${attempt.id}`} className="rounded-[var(--radius-md)] border bg-card p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 id={`feedback-${attempt.id}`} className="font-display text-base font-[650]">
					Feedback
				</h3>
				<AiLabel label="AI feedback" hint={FEEDBACK_HINT} />
			</div>
			<FeedbackBody feedback={attempt.feedback} />
			<div className="mt-4 border-t pt-3">
				<FlagButton attempt={attempt} onFlagged={onFlagged} />
			</div>
		</section>
	);
}
