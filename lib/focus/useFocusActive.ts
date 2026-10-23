"use client";

// `useFocusActive()` re-renders when a focus session starts, pauses, stops or runs out, in
// this tab or another one. No provider is needed: the timer lives in localStorage.

import { useSyncExternalStore } from "react";
import { FOCUS_CHANGE_EVENT, FOCUS_TIMER_KEY, isFocusActive } from "./timerStorage";

/** A session can run out without any event, so re-check on a slow clock too. */
const RECHECK_MS = 15_000;

function subscribe(onChange: () => void) {
	const onStorage = (event: StorageEvent) => {
		if (event.key === null || event.key === FOCUS_TIMER_KEY) onChange();
	};
	window.addEventListener(FOCUS_CHANGE_EVENT, onChange);
	window.addEventListener("storage", onStorage);
	const timer = window.setInterval(onChange, RECHECK_MS);
	return () => {
		window.removeEventListener(FOCUS_CHANGE_EVENT, onChange);
		window.removeEventListener("storage", onStorage);
		window.clearInterval(timer);
	};
}

function getSnapshot() {
	return isFocusActive();
}

function getServerSnapshot() {
	return false;
}

export function useFocusActive(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
