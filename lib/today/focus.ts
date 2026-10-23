/** Weekly focus summary for the Today page. Progress only, never streaks. */
import type { WeeklyFocus } from "./types";

export type FocusProgress = { label: string; percent: number | null };

function toHours(minutes: number): number {
	return Math.round((minutes / 60) * 10) / 10;
}

function hoursWord(hours: number): string {
	return hours === 1 ? "hour" : "hours";
}

function formatHours(minutes: number): string {
	const hours = toHours(minutes);
	return `${hours} ${hoursWord(hours)}`;
}

export function focusProgress(focus: WeeklyFocus): FocusProgress {
	if (focus.goalHours === null) {
		return { label: formatHours(focus.minutes), percent: null };
	}
	const percent = Math.min(100, Math.round((focus.minutes / (focus.goalHours * 60)) * 100));
	return { label: `${toHours(focus.minutes)} of ${focus.goalHours} ${hoursWord(focus.goalHours)}`, percent };
}
