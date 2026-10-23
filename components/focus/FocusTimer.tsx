"use client";

import { CheckCircle2, CloudOff } from "lucide-react";
import { Skeleton } from "@/components/app/blocks";
import { formatMinutes } from "@/lib/focus/week";
import type { FocusSessionRecord } from "@/lib/focus/timer";
import { ActiveTimer } from "./ActiveTimer";
import { FocusStartForm } from "./FocusStartForm";
import { useFocusTimer } from "./useFocusTimer";
import { WeeklyFocusTotal } from "./WeeklyFocusTotal";

function SessionNote({ session }: Readonly<{ session: FocusSessionRecord | null }>) {
	if (!session) return null;
	const minutes = Math.round(session.focused_seconds / 60);
	const message = session.completed
		? `Session complete: ${formatMinutes(minutes)} on ${session.task_label}.`
		: `Stopped early: ${formatMinutes(minutes)} on ${session.task_label} was saved.`;
	return (
		<p className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--success-soft)] px-3 py-2 text-sm">
			<CheckCircle2 className="h-4 w-4 flex-none text-[var(--success)]" aria-hidden="true" />
			{message}
		</p>
	);
}

function PendingNote({ count }: Readonly<{ count: number }>) {
	if (count === 0) return null;
	return (
		<p className="flex items-center gap-2 text-xs text-muted-foreground">
			<CloudOff className="h-3.5 w-3.5" aria-hidden="true" />
			{count === 1 ? "1 session" : `${count} sessions`} saved on this device. They sync when you are back online.
		</p>
	);
}

/** The timer card: start form or running timer, the last result and this week's total. */
export function FocusTimer() {
	const focus = useFocusTimer();

	const body = focus.timer ? (
		<ActiveTimer timer={focus.timer} now={focus.now} onPause={focus.pause} onResume={focus.resume} onStop={focus.stop} />
	) : (
		<FocusStartForm onStart={focus.start} />
	);

	return (
		<section aria-labelledby="focus-timer-heading" className="space-y-4">
			<h2 id="focus-timer-heading" className="sr-only">
				Focus timer
			</h2>
			<div className="rounded-[var(--radius-md)] border bg-card p-5 md:p-6">
				{focus.ready ? body : <Skeleton className="h-56 w-full" />}
			</div>
			<output aria-live="polite" className="block">
				<SessionNote session={focus.lastSession} />
			</output>
			<PendingNote count={focus.pendingCount} />
			<WeeklyFocusTotal syncVersion={focus.syncVersion} />
		</section>
	);
}
