import "server-only";

// Pushes the blocks a user creates to their "NextMilestone" Google calendar. Every function
// is best effort: the block is saved in NextMilestone whether or not Google accepts it.

import type { ExternalEvent, ScheduleBlock } from "@/lib/focus/schemas";
import {
	GoogleApiError,
	createAppCalendar,
	deleteEvent,
	insertEvent,
	listPrimaryEvents,
	patchEvent,
} from "./calendarApi";
import { getActiveConnection, saveAppCalendarId, type GoogleConnection } from "./connection";

type BlockFields = Pick<ScheduleBlock, "id" | "kind" | "title" | "starts_at" | "ends_at" | "google_event_id">;

async function ensureAppCalendar(connection: GoogleConnection, timeZone: string | null) {
	if (connection.appCalendarId) return connection.appCalendarId;
	const calendarId = await createAppCalendar(connection.accessToken, timeZone);
	await saveAppCalendarId(connection.userId, calendarId);
	return calendarId;
}

function isGone(error: unknown) {
	return error instanceof GoogleApiError && (error.status === 404 || error.status === 410);
}

async function upsertEvent(connection: GoogleConnection, calendarId: string, block: BlockFields) {
	if (!block.google_event_id) return insertEvent(connection.accessToken, calendarId, block);
	try {
		await patchEvent(connection.accessToken, calendarId, block.google_event_id, block);
		return block.google_event_id;
	} catch (error) {
		// Deleted in Google: create it again.
		if (isGone(error)) return insertEvent(connection.accessToken, calendarId, block);
		throw error;
	}
}

/**
 * Creates or updates the Google event for a block. Returns the event id to store, the
 * existing id when sync fails, or null when Google Calendar isn't connected.
 */
export async function pushBlockToGoogle(
	userId: string,
	block: BlockFields,
	timeZone: string | null = null
): Promise<string | null> {
	const connection = await getActiveConnection(userId);
	if (!connection) return block.google_event_id;
	try {
		const calendarId = await ensureAppCalendar(connection, timeZone);
		return await upsertEvent(connection, calendarId, block);
	} catch (error) {
		console.error("Google Calendar push failed", error instanceof Error ? error.message : error);
		return block.google_event_id;
	}
}

export async function removeBlockFromGoogle(userId: string, googleEventId: string | null) {
	if (!googleEventId) return;
	const connection = await getActiveConnection(userId);
	if (!connection?.appCalendarId) return;
	try {
		await deleteEvent(connection.accessToken, connection.appCalendarId, googleEventId);
	} catch (error) {
		console.error("Google Calendar delete failed", error instanceof Error ? error.message : error);
	}
}

export type GoogleEventsResult = Readonly<{ connected: boolean; events: ExternalEvent[]; error?: string }>;

/** The user's primary-calendar events in a range, for the week view. */
export async function readGoogleEvents(
	userId: string,
	range: Readonly<{ start: string; end: string }>
): Promise<GoogleEventsResult> {
	const connection = await getActiveConnection(userId);
	if (!connection) return { connected: false, events: [] };
	try {
		return { connected: true, events: await listPrimaryEvents(connection.accessToken, range) };
	} catch (error) {
		console.error("Google Calendar read failed", error instanceof Error ? error.message : error);
		return { connected: true, events: [], error: "Could not load your Google Calendar events" };
	}
}
