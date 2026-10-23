// Browser storage for the running focus timer, plus `isFocusActive()` for anything that
// should hold its notifications during a session. Every storage access is wrapped: private
// windows and blocked site data make localStorage throw or come back empty.

import { isFinished, parseTimerState, type FocusTimerState } from "./timer";

export const FOCUS_TIMER_KEY = "nm.focus.timer.v1";
/** Fired on window whenever this tab changes the timer (the storage event covers other tabs). */
export const FOCUS_CHANGE_EVENT = "nm:focus-change";

function storage(): Storage | null {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}

function notify() {
	if (typeof window !== "undefined") window.dispatchEvent(new Event(FOCUS_CHANGE_EVENT));
}

export function loadTimer(): FocusTimerState | null {
	try {
		const raw = storage()?.getItem(FOCUS_TIMER_KEY);
		return raw ? parseTimerState(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
}

export function saveTimer(state: FocusTimerState) {
	try {
		storage()?.setItem(FOCUS_TIMER_KEY, JSON.stringify(state));
	} catch {
		// Storage full or blocked: the timer still runs for this page view.
	}
	notify();
}

export function clearTimer() {
	try {
		storage()?.removeItem(FOCUS_TIMER_KEY);
	} catch {
		// ignore
	}
	notify();
}

/** True while a focus session is running or paused and has time left. */
export function isFocusActive(now: number = Date.now()): boolean {
	const state = loadTimer();
	return state !== null && !isFinished(state, now);
}
