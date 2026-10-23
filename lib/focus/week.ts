// Week math for the schedule (weeks run Monday to Sunday) and US-format labels.
// All functions work in the runtime's local time zone: the browser's for the week view.

export function startOfWeek(date: Date): Date {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const daysSinceMonday = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - daysSinceMonday);
	return start;
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

export function weekDays(weekStart: Date): Date[] {
	return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function isSameDay(a: Date, b: Date) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Mon, Oct 26" */
export function formatDayLabel(date: Date) {
	return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "9:00 AM" */
export function formatTime(date: Date) {
	return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Oct 26 – Nov 1, 2026" */
export function formatWeekRange(weekStart: Date) {
	const end = addDays(weekStart, 6);
	const startLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	return `${startLabel} – ${endLabel}`;
}

function pad(value: number) {
	return String(value).padStart(2, "0");
}

/** Value for <input type="date">: "2026-10-26" in local time */
export function toDateInput(date: Date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Value for <input type="time">: "09:30" in local time */
export function toTimeInput(date: Date) {
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combines date and time input values into a local Date; null when either is invalid. */
export function fromDateTimeInputs(dateValue: string, timeValue: string): Date | null {
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
	const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
	if (!dateMatch || !timeMatch) return null;
	const [, y, m, d] = dateMatch.map(Number);
	const [, hh, mm] = timeMatch.map(Number);
	const result = new Date(y, m - 1, d, hh, mm);
	return Number.isNaN(result.getTime()) ? null : result;
}

/** Items whose start falls on `day`, sorted by start. */
export function itemsOnDay<T extends { starts_at: string }>(items: readonly T[], day: Date): T[] {
	return items
		.filter((item) => isSameDay(new Date(item.starts_at), day))
		.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

export function minutesBetween(start: string, end: string) {
	return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
}

/** "1 hr 30 min", "45 min", "2 hr" */
export function formatMinutes(total: number) {
	const hours = Math.floor(total / 60);
	const minutes = total % 60;
	if (hours === 0) return `${minutes} min`;
	if (minutes === 0) return `${hours} hr`;
	return `${hours} hr ${minutes} min`;
}
