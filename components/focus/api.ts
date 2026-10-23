// Client calls for the focus page. Each throws an Error with a readable message on failure.

import type { CreateBlockInput, ExternalEvent, ScheduleBlock, UpdateBlockInput } from "@/lib/focus/schemas";

export type WeeklySummary = Readonly<{
	minutes: number;
	sessions: number;
	completedSessions: number;
	goalMinutes: number | null;
}>;

export type GoogleEventsResponse = Readonly<{
	available: boolean;
	connected: boolean;
	events: ExternalEvent[];
	error?: string;
}>;

function timeZoneHeader(): Record<string, string> {
	try {
		return { "X-Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone };
	} catch {
		return {};
	}
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	const body = (await res.json().catch(() => ({}))) as T & { error?: string };
	if (!res.ok) throw new Error(body.error || "Something went wrong. Try again.");
	return body;
}

function rangeQuery(start: Date, end: Date) {
	return new URLSearchParams({ start: start.toISOString(), end: end.toISOString() }).toString();
}

export async function fetchWeeklySummary(weekStart: Date): Promise<WeeklySummary> {
	const query = new URLSearchParams({ weekStart: weekStart.toISOString() }).toString();
	const body = await request<{ summary: WeeklySummary }>(`/api/focus/sessions?${query}`);
	return body.summary;
}

export async function fetchBlocks(start: Date, end: Date): Promise<ScheduleBlock[]> {
	const body = await request<{ blocks: ScheduleBlock[] }>(`/api/schedule/blocks?${rangeQuery(start, end)}`);
	return body.blocks;
}

export async function fetchGoogleEvents(start: Date, end: Date): Promise<GoogleEventsResponse> {
	return request<GoogleEventsResponse>(`/api/calendar/google/events?${rangeQuery(start, end)}`);
}

export async function createBlock(input: CreateBlockInput): Promise<ScheduleBlock> {
	const body = await request<{ block: ScheduleBlock }>("/api/schedule/blocks", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...timeZoneHeader() },
		body: JSON.stringify(input),
	});
	return body.block;
}

export async function updateBlock(id: string, input: UpdateBlockInput): Promise<ScheduleBlock> {
	const body = await request<{ block: ScheduleBlock }>(`/api/schedule/blocks/${encodeURIComponent(id)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", ...timeZoneHeader() },
		body: JSON.stringify(input),
	});
	return body.block;
}

export async function deleteBlock(id: string): Promise<void> {
	await request(`/api/schedule/blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
}
