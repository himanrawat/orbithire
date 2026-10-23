"use client";

import { useEffect, useState } from "react";

/** Seconds left until `endsAt` (ms epoch), ticking every second; null when not running. */
export function useCountdown(endsAt: number | null): number | null {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (endsAt === null) return;
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [endsAt]);

	if (endsAt === null) return null;
	return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
