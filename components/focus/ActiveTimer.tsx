"use client";

import { BellOff, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { elapsedMs, formatClock, plannedMs, remainingMs, type FocusTimerState } from "@/lib/focus/timer";

type ActiveTimerProps = Readonly<{
	timer: FocusTimerState;
	now: number;
	onPause: () => void;
	onResume: () => void;
	onStop: () => void;
}>;

/** Changes once a minute, so screen readers aren't flooded every second. */
function statusText(timer: FocusTimerState, remaining: number) {
	const minutes = Math.ceil(remaining / 60_000);
	const left = `${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
	return timer.status === "paused" ? `Paused, ${left}` : `Focusing, ${left}`;
}

function PauseResumeButton({ paused, onPause, onResume }: Readonly<{ paused: boolean; onPause: () => void; onResume: () => void }>) {
	if (paused) {
		return (
			<Button type="button" variant="cap" size="lg" onClick={onResume}>
				<Play className="mr-2 h-4 w-4" aria-hidden="true" />
				Resume
			</Button>
		);
	}
	return (
		<Button type="button" variant="secondary" size="lg" onClick={onPause}>
			<Pause className="mr-2 h-4 w-4" aria-hidden="true" />
			Pause
		</Button>
	);
}

export function ActiveTimer({ timer, now, onPause, onResume, onStop }: ActiveTimerProps) {
	const remaining = remainingMs(timer, now);
	const progress = Math.round((elapsedMs(timer, now) / plannedMs(timer)) * 100);

	return (
		<div className="space-y-5 text-center">
			<p className="text-sm text-muted-foreground">
				{timer.plannedMinutes}-minute session on <span className="font-medium text-foreground">{timer.taskLabel}</span>
			</p>
			<p aria-hidden="true" className="font-mono text-6xl font-semibold tabular-nums tracking-[-0.03em] md:text-7xl">
				{formatClock(remaining)}
			</p>
			<progress
				value={progress}
				max={100}
				aria-label="Session progress"
				className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-[var(--kind-focus)] [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-[var(--kind-focus)]"
			/>
			<output aria-live="polite" className="block text-sm font-medium">
				{statusText(timer, remaining)}
			</output>
			<div className="flex flex-wrap justify-center gap-2">
				<PauseResumeButton paused={timer.status === "paused"} onPause={onPause} onResume={onResume} />
				<Button type="button" variant="outline" size="lg" onClick={onStop}>
					<Square className="mr-2 h-4 w-4" aria-hidden="true" />
					Stop
				</Button>
			</div>
			<p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
				<BellOff className="h-3.5 w-3.5" aria-hidden="true" />
				App notifications are on hold until this session ends.
			</p>
		</div>
	);
}
