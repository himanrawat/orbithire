"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/prep/mock";
import { useCountdown } from "./useCountdown";

const THINK_OPTIONS = [30, 60, 120] as const;

type ThinkStepProps = Readonly<{ onReady: () => void }>;

function TimerReadout({ remaining }: Readonly<{ remaining: number }>) {
	if (remaining === 0) {
		return <output className="font-mono text-2xl tabular-nums text-[var(--success)]">Time to answer</output>;
	}
	return (
		<output className="font-mono text-2xl tabular-nums" aria-live="off">
			{formatClock(remaining)}
		</output>
	);
}

/** Step 1: think. An optional timer; answering is always one click away. */
export function ThinkStep({ onReady }: ThinkStepProps) {
	const [endsAt, setEndsAt] = useState<number | null>(null);
	const remaining = useCountdown(endsAt);

	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				Take a moment to plan. Jot down the two or three points you want to make, or start a short timer.
			</p>
			<fieldset className="flex flex-wrap items-center gap-2">
				<legend className="sr-only">Thinking timer</legend>
				{THINK_OPTIONS.map((seconds) => (
					<Button
						key={seconds}
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setEndsAt(Date.now() + seconds * 1000)}
					>
						{seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`}
					</Button>
				))}
				{remaining !== null && <TimerReadout remaining={remaining} />}
			</fieldset>
			<Button type="button" variant="cap" onClick={onReady}>
				I&apos;m ready to answer
			</Button>
		</div>
	);
}
