// Google Calendar v3 REST calls over fetch. Reads go to the primary calendar only;
// writes go to the app-created "NextMilestone" calendar only (see config.ts for scopes).

import type { ExternalEvent, ScheduleBlock } from "@/lib/focus/schemas";
import { BLOCK_KIND_LABELS } from "@/lib/focus/schemas";
import { APP_CALENDAR_NAME, GOOGLE_CALENDAR_API } from "./config";

export class GoogleApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = "GoogleApiError";
	}
}

type GoogleEventTime = { dateTime?: string; date?: string };
type GoogleEvent = {
	id?: string;
	status?: string;
	summary?: string;
	start?: GoogleEventTime;
	end?: GoogleEventTime;
	transparency?: string;
};

const MAX_EVENTS = 250;

async function googleFetch<T>(
	accessToken: string,
	path: string,
	init: RequestInit = {},
	fetchImpl: typeof fetch = fetch
): Promise<T | null> {
	const res = await fetchImpl(`${GOOGLE_CALENDAR_API}${path}`, {
		...init,
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init.headers },
		cache: "no-store",
	});
	if (!res.ok) throw new GoogleApiError(`Google Calendar request failed (${res.status})`, res.status);
	if (res.status === 204) return null;
	return (await res.json().catch(() => null)) as T | null;
}

/** An all-day "date" becomes local midnight in ISO form so the week view can place it. */
function toIso(time: GoogleEventTime | undefined): string | null {
	if (time?.dateTime) return new Date(time.dateTime).toISOString();
	if (time?.date) return `${time.date}T00:00:00`;
	return null;
}

export function toExternalEvent(event: GoogleEvent): ExternalEvent | null {
	const starts = toIso(event.start);
	const ends = toIso(event.end);
	if (!event.id || !starts || !ends || event.status === "cancelled") return null;
	return {
		id: event.id,
		title: event.summary?.slice(0, 200) || "Busy",
		starts_at: starts,
		ends_at: ends,
		all_day: Boolean(event.start?.date),
	};
}

export async function listPrimaryEvents(
	accessToken: string,
	range: Readonly<{ start: string; end: string }>,
	fetchImpl: typeof fetch = fetch
): Promise<ExternalEvent[]> {
	const params = new URLSearchParams({
		timeMin: range.start,
		timeMax: range.end,
		singleEvents: "true",
		orderBy: "startTime",
		maxResults: String(MAX_EVENTS),
		fields: "items(id,status,summary,start,end)",
	});
	const body = await googleFetch<{ items?: GoogleEvent[] }>(
		accessToken,
		`/calendars/primary/events?${params.toString()}`,
		{},
		fetchImpl
	);
	return (body?.items ?? []).map(toExternalEvent).filter((e): e is ExternalEvent => e !== null);
}

export async function createAppCalendar(accessToken: string, timeZone: string | null, fetchImpl: typeof fetch = fetch) {
	const body = await googleFetch<{ id?: string }>(
		accessToken,
		"/calendars",
		{
			method: "POST",
			body: JSON.stringify({
				summary: APP_CALENDAR_NAME,
				description: "Blocks you schedule in NextMilestone.",
				...(timeZone ? { timeZone } : {}),
			}),
		},
		fetchImpl
	);
	if (!body?.id) throw new GoogleApiError("Google did not return a calendar id", 502);
	return body.id;
}

export function blockToEvent(block: Pick<ScheduleBlock, "id" | "kind" | "title" | "starts_at" | "ends_at">) {
	return {
		summary: block.title,
		description: `${BLOCK_KIND_LABELS[block.kind]} block from NextMilestone.`,
		start: { dateTime: new Date(block.starts_at).toISOString() },
		end: { dateTime: new Date(block.ends_at).toISOString() },
		extendedProperties: { private: { nextmilestoneBlockId: block.id } },
	};
}

function eventsPath(calendarId: string, eventId?: string) {
	const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
	return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

export async function insertEvent(
	accessToken: string,
	calendarId: string,
	block: Parameters<typeof blockToEvent>[0],
	fetchImpl: typeof fetch = fetch
): Promise<string> {
	const body = await googleFetch<{ id?: string }>(
		accessToken,
		eventsPath(calendarId),
		{ method: "POST", body: JSON.stringify(blockToEvent(block)) },
		fetchImpl
	);
	if (!body?.id) throw new GoogleApiError("Google did not return an event id", 502);
	return body.id;
}

export async function patchEvent(
	accessToken: string,
	calendarId: string,
	eventId: string,
	block: Parameters<typeof blockToEvent>[0],
	fetchImpl: typeof fetch = fetch
): Promise<void> {
	await googleFetch(
		accessToken,
		eventsPath(calendarId, eventId),
		{ method: "PATCH", body: JSON.stringify(blockToEvent(block)) },
		fetchImpl
	);
}

/** Deleting an event that is already gone counts as success. */
export async function deleteEvent(
	accessToken: string,
	calendarId: string,
	eventId: string,
	fetchImpl: typeof fetch = fetch
): Promise<void> {
	try {
		await googleFetch(accessToken, eventsPath(calendarId, eventId), { method: "DELETE" }, fetchImpl);
	} catch (error) {
		if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) return;
		throw error;
	}
}
