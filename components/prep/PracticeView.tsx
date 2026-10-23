"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/app/blocks";
import type { PracticeAttempt, PrepQuestion } from "@/lib/prep/constants";
import { errorMessage, fetchQuestion } from "./api";
import { PracticeSession } from "./PracticeSession";

type Loaded = { question: PrepQuestion; attempts: PracticeAttempt[] };

function PastAttempts({ attempts }: Readonly<{ attempts: readonly PracticeAttempt[] }>) {
	if (attempts.length === 0) return null;
	const label = attempts.length === 1 ? "1 earlier attempt" : `${attempts.length} earlier attempts`;
	return <p className="text-sm text-muted-foreground">You&apos;ve practiced this before: {label}.</p>;
}

/** Practice one question from the bank. */
export function PracticeView({ questionId }: Readonly<{ questionId: string }>) {
	const [data, setData] = useState<Loaded | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [round, setRound] = useState(0);

	useEffect(() => {
		fetchQuestion(questionId)
			.then(setData)
			.catch((e: unknown) => setError(errorMessage(e, "Could not load this question")));
	}, [questionId]);

	if (error) return <p className="text-sm text-[var(--danger)]">{error}</p>;
	if (!data) return <Skeleton className="h-64" />;

	return (
		<div className="space-y-4">
			<PastAttempts attempts={data.attempts} />
			<PracticeSession
				key={round}
				question={data.question}
				reviewAction={
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" onClick={() => setRound((r) => r + 1)}>
							Try again
						</Button>
						<Button variant="ghost" asChild>
							<Link href="/prep">Back to the question bank</Link>
						</Button>
					</div>
				}
			/>
		</div>
	);
}
