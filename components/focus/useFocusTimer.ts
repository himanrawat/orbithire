"use client";

// The focus timer's state for the page. The source of truth is the timestamped state in
// localStorage; the 1-second interval only re-renders the clock. Finished sessions go to the
// offline outbox and sync when the browser is online.

import { useCallback, useEffect, useState } from "react";
import { focusSessionQueue } from "@/lib/focus/offlineQueue";
import {
	finishTimer,
	isFinished,
	newClientId,
	pauseTimer,
	resumeTimer,
	startTimer,
	type FocusDuration,
	type FocusSessionRecord,
	type FocusTimerState,
} from "@/lib/focus/timer";
import { clearTimer, loadTimer, saveTimer } from "@/lib/focus/timerStorage";

export type FocusTimerApi = Readonly<{
	timer: FocusTimerState | null;
	now: number;
	ready: boolean;
	lastSession: FocusSessionRecord | null;
	pendingCount: number;
	/** bumps after each successful sync, so totals can refetch */
	syncVersion: number;
	start: (input: Readonly<{ taskLabel: string; taskRef: string | null; plannedMinutes: FocusDuration }>) => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
}>;

function useTicker(running: boolean) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		setNow(Date.now());
		if (!running) return;
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [running]);
	return now;
}

function useOutbox() {
	const [pendingCount, setPendingCount] = useState(0);
	const [syncVersion, setSyncVersion] = useState(0);

	const flush = useCallback(async () => {
		const result = await focusSessionQueue.flush();
		setPendingCount(result.remaining);
		if (result.sent > 0) setSyncVersion((v) => v + 1);
	}, []);

	useEffect(() => {
		setPendingCount(focusSessionQueue.read().length);
		const onOnline = () => void flush();
		window.addEventListener("online", onOnline);
		void flush();
		return () => window.removeEventListener("online", onOnline);
	}, [flush]);

	const enqueue = useCallback(
		(session: FocusSessionRecord) => {
			focusSessionQueue.enqueue(session);
			setPendingCount(focusSessionQueue.read().length);
			void flush();
		},
		[flush]
	);

	return { pendingCount, syncVersion, enqueue };
}

export function useFocusTimer(): FocusTimerApi {
	const [timer, setTimer] = useState<FocusTimerState | null>(null);
	const [ready, setReady] = useState(false);
	const [lastSession, setLastSession] = useState<FocusSessionRecord | null>(null);
	const now = useTicker(timer?.status === "running");
	const { pendingCount, syncVersion, enqueue } = useOutbox();

	// Load once, and follow changes from other tabs.
	useEffect(() => {
		const reload = () => setTimer(loadTimer());
		reload();
		setReady(true);
		window.addEventListener("storage", reload);
		return () => window.removeEventListener("storage", reload);
	}, []);

	const finish = useCallback(
		(state: FocusTimerState, at: number) => {
			const record = finishTimer(state, at);
			clearTimer();
			setTimer(null);
			setLastSession(record);
			if (record) enqueue(record);
		},
		[enqueue]
	);

	// Runs out while open, or was already over when the page loaded.
	useEffect(() => {
		if (timer && isFinished(timer, now)) finish(timer, now);
	}, [timer, now, finish]);

	const update = useCallback((next: FocusTimerState) => {
		saveTimer(next);
		setTimer(next);
	}, []);

	const start: FocusTimerApi["start"] = useCallback(
		(input) => {
			setLastSession(null);
			update(startTimer({ ...input, clientId: newClientId() }, Date.now()));
		},
		[update]
	);

	const pause = useCallback(() => {
		if (timer) update(pauseTimer(timer, Date.now()));
	}, [timer, update]);

	const resume = useCallback(() => {
		if (timer) update(resumeTimer(timer, Date.now()));
	}, [timer, update]);

	const stop = useCallback(() => {
		if (timer) finish(timer, Date.now());
	}, [timer, finish]);

	return { timer, now, ready, lastSession, pendingCount, syncVersion, start, pause, resume, stop };
}
