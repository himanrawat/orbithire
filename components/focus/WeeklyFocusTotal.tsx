"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { StatTile } from "@/components/app/blocks";
import { formatMinutes, startOfWeek } from "@/lib/focus/week";
import { fetchWeeklySummary, type WeeklySummary } from "./api";

function totalLabel(summary: WeeklySummary | null) {
	if (!summary) return "–";
	if (summary.goalMinutes === null) return formatMinutes(summary.minutes);
	return `${formatMinutes(summary.minutes)} of ${formatMinutes(summary.goalMinutes)}`;
}

function sessionsLabel(summary: WeeklySummary | null) {
	if (!summary) return "Focus this week";
	const count = summary.completedSessions;
	return `Focus this week · ${count} completed ${count === 1 ? "session" : "sessions"}`;
}

/** This week's focus time (Monday to now, local time) against the goal. No streaks. */
export function WeeklyFocusTotal({ syncVersion }: Readonly<{ syncVersion: number }>) {
	const [summary, setSummary] = useState<WeeklySummary | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchWeeklySummary(startOfWeek(new Date()))
			.then((next) => {
				if (!cancelled) setSummary(next);
			})
			.catch(() => {
				// Offline or signed out: keep the last value.
			});
		return () => {
			cancelled = true;
		};
	}, [syncVersion]);

	return <StatTile icon={<Clock />} tone="focus" value={totalLabel(summary)} label={sessionsLabel(summary)} />;
}
