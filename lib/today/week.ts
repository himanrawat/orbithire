/** The Today page's week strip and greeting. Pure helpers, no server imports. */
import { safeTimeZone } from "./nextStep";
import type { WeekDay } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

function keyToUtc(key: string): number {
	const [y, m, d] = key.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** YYYY-MM-DD of the Monday that starts the week containing `todayKey`. */
export function weekStartKey(todayKey: string): string {
	const ms = keyToUtc(todayKey);
	const mondayOffset = (new Date(ms).getUTCDay() + 6) % 7;
	return utcToKey(ms - mondayOffset * DAY_MS);
}

/** Monday to Sunday for the week of `todayKey`, marked by the dates with activity. */
export function buildWeek(todayKey: string, activeDates: ReadonlySet<string>): WeekDay[] {
	const start = keyToUtc(weekStartKey(todayKey));
	return LABELS.map((label, i) => {
		const date = utcToKey(start + i * DAY_MS);
		const active = activeDates.has(date);
		let state: WeekDay["state"] = "upcoming";
		if (active) state = "active";
		else if (date === todayKey) state = "today";
		else if (date < todayKey) state = "open";
		return { date, label, state };
	});
}

export function activeDayCount(week: readonly WeekDay[]): number {
	return week.filter((d) => d.state === "active").length;
}

/** "Good morning, Maya" by the hour in the person's time zone. */
export function greetingFor(now: Date, timeZone: string, firstName: string | null): string {
	const hour = Number(
		new Intl.DateTimeFormat("en-US", { timeZone: safeTimeZone(timeZone), hour: "numeric", hourCycle: "h23" }).format(now)
	);
	let part = "evening";
	if (hour >= 5 && hour < 12) part = "morning";
	else if (hour >= 12 && hour < 17) part = "afternoon";
	return firstName ? `Good ${part}, ${firstName}` : `Good ${part}`;
}
