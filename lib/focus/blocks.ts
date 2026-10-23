import "server-only";

// Database calls for schedule blocks, shared by the /api/schedule/blocks routes.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateBlockInput, ScheduleBlock, UpdateBlockInput } from "./schemas";
import { BLOCK_COLUMNS } from "./server";

export async function listBlocks(
	supabase: SupabaseClient,
	userId: string,
	range: Readonly<{ start: string; end: string }>
): Promise<ScheduleBlock[]> {
	const { data, error } = await supabase
		.from("schedule_blocks")
		.select(BLOCK_COLUMNS)
		.eq("user_id", userId)
		.lt("starts_at", range.end)
		.gt("ends_at", range.start)
		.order("starts_at", { ascending: true })
		.limit(500);
	if (error) throw new Error(error.message);
	return (data ?? []) as ScheduleBlock[];
}

export async function getBlock(supabase: SupabaseClient, userId: string, id: string): Promise<ScheduleBlock | null> {
	const { data } = await supabase
		.from("schedule_blocks")
		.select(BLOCK_COLUMNS)
		.eq("user_id", userId)
		.eq("id", id)
		.maybeSingle();
	return (data as ScheduleBlock | null) ?? null;
}

export async function insertBlock(supabase: SupabaseClient, userId: string, input: CreateBlockInput): Promise<ScheduleBlock> {
	const { data, error } = await supabase
		.from("schedule_blocks")
		.insert({ user_id: userId, ...input })
		.select(BLOCK_COLUMNS)
		.single();
	if (error || !data) throw new Error(error?.message ?? "Insert failed");
	return data as ScheduleBlock;
}

export async function updateBlock(
	supabase: SupabaseClient,
	userId: string,
	id: string,
	update: UpdateBlockInput | { google_event_id: string | null }
): Promise<ScheduleBlock | null> {
	const { data, error } = await supabase
		.from("schedule_blocks")
		.update({ ...update, updated_at: new Date().toISOString() })
		.eq("user_id", userId)
		.eq("id", id)
		.select(BLOCK_COLUMNS)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return (data as ScheduleBlock | null) ?? null;
}

export async function deleteBlock(supabase: SupabaseClient, userId: string, id: string) {
	const { error } = await supabase.from("schedule_blocks").delete().eq("user_id", userId).eq("id", id);
	if (error) throw new Error(error.message);
}

/** Stores the Google event id after a push, when it changed. */
export async function linkGoogleEvent(
	supabase: SupabaseClient,
	userId: string,
	block: ScheduleBlock,
	googleEventId: string | null
): Promise<ScheduleBlock> {
	if (googleEventId === block.google_event_id) return block;
	const updated = await updateBlock(supabase, userId, block.id, { google_event_id: googleEventId });
	return updated ?? block;
}

/** IANA zone from the X-Time-Zone header, used when creating the Google calendar. */
export function readTimeZone(headers: Headers): string | null {
	const value = headers.get("x-time-zone");
	return value && /^[A-Za-z0-9_+\-/]{1,64}$/.test(value) ? value : null;
}
