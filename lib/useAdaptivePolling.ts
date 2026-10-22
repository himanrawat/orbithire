"use client";

import { useEffect, useRef } from "react";

export function useAdaptivePolling(
	callback: () => void | Promise<void>,
	options: { enabled?: boolean; intervalMs: number; maxIntervalMs?: number }
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (options.enabled === false) return;
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let interval = options.intervalMs;
		const maxInterval = options.maxIntervalMs ?? options.intervalMs * 8;

		const schedule = () => {
			if (cancelled || document.visibilityState === "hidden") return;
			timer = setTimeout(run, interval);
		};
		const run = async () => {
			if (cancelled || document.visibilityState === "hidden") return;
			try {
				await callbackRef.current();
				interval = options.intervalMs;
			} catch {
				interval = Math.min(maxInterval, interval * 2);
			} finally {
				schedule();
			}
		};
		const onVisibility = () => {
			if (timer) clearTimeout(timer);
			if (document.visibilityState === "visible") {
				interval = options.intervalMs;
				void run();
			}
		};

		document.addEventListener("visibilitychange", onVisibility);
		schedule();
		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [options.enabled, options.intervalMs, options.maxIntervalMs]);
}
