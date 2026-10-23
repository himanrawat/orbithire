/**
 * Server-only data helpers for milestones and the public profile. Owner reads and writes
 * use the caller's RLS-scoped client; the public profile goes through the
 * get_public_profile() SECURITY DEFINER function, which returns public fields only.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	MILESTONE_COLUMNS,
	PUBLIC_SETTINGS_COLUMNS,
	SUGGESTION_COLUMNS,
	parsePublicLearning,
	parsePublicProfile,
	type Milestone,
	type MilestoneSuggestion,
	type PublicLearningEntry,
	type PublicProfile,
	type PublicProfileSettings,
} from "./model";
import type { MilestoneCreate, MilestoneUpdate, PublicSettingsUpdate } from "./schema";

export const MILESTONE_LIST_LIMIT = 500;
const UNIQUE_VIOLATION = "23505";

export function jsonError(message: string, status: number) {
	return NextResponse.json({ error: message }, { status });
}

export async function listMilestones(supabase: SupabaseClient, userId: string): Promise<Milestone[]> {
	const { data, error } = await supabase
		.from("milestones")
		.select(MILESTONE_COLUMNS)
		.eq("user_id", userId)
		.order("happened_on", { ascending: false })
		.order("created_at", { ascending: false })
		.limit(MILESTONE_LIST_LIMIT);
	if (error) throw new Error(error.message);
	return (data ?? []) as Milestone[];
}

export async function createMilestone(
	supabase: SupabaseClient,
	userId: string,
	input: Omit<MilestoneCreate, "kind" | "visibility"> &
		Partial<Pick<MilestoneCreate, "kind" | "visibility">> & { source?: Milestone["source"]; source_ref?: string | null }
): Promise<Milestone> {
	const row = {
		...input,
		kind: input.kind ?? "other",
		visibility: input.visibility ?? "private",
		description: input.description ?? null,
		user_id: userId,
	};
	const { data, error } = await supabase
		.from("milestones")
		.insert(row)
		.select(MILESTONE_COLUMNS)
		.single();
	if (error) throw new Error(error.message);
	return data as Milestone;
}

export async function updateMilestone(
	supabase: SupabaseClient,
	userId: string,
	id: string,
	update: MilestoneUpdate
): Promise<Milestone | null> {
	const { data, error } = await supabase
		.from("milestones")
		.update(update)
		.eq("id", id)
		.eq("user_id", userId)
		.select(MILESTONE_COLUMNS)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return (data as Milestone | null) ?? null;
}

export async function deleteMilestone(supabase: SupabaseClient, userId: string, id: string): Promise<boolean> {
	const { data, error } = await supabase
		.from("milestones")
		.delete()
		.eq("id", id)
		.eq("user_id", userId)
		.select("id");
	if (error) throw new Error(error.message);
	return (data ?? []).length > 0;
}

// ==================== Suggestions ====================

/** Builds suggestions from events, then returns the pending ones. */
export async function refreshAndListSuggestions(
	supabase: SupabaseClient,
	userId: string
): Promise<MilestoneSuggestion[]> {
	const refresh = await supabase.rpc("refresh_milestone_suggestions");
	if (refresh.error) console.error("[milestones] refresh suggestions failed:", refresh.error.message);
	const { data, error } = await supabase
		.from("milestone_suggestions")
		.select(SUGGESTION_COLUMNS)
		.eq("user_id", userId)
		.eq("status", "pending")
		.order("happened_on", { ascending: false })
		.limit(50);
	if (error) throw new Error(error.message);
	return (data ?? []) as MilestoneSuggestion[];
}

export async function loadPendingSuggestion(
	supabase: SupabaseClient,
	userId: string,
	id: string
): Promise<MilestoneSuggestion | null> {
	const { data, error } = await supabase
		.from("milestone_suggestions")
		.select(SUGGESTION_COLUMNS)
		.eq("id", id)
		.eq("user_id", userId)
		.eq("status", "pending")
		.maybeSingle();
	if (error) throw new Error(error.message);
	return (data as MilestoneSuggestion | null) ?? null;
}

export async function setSuggestionStatus(
	supabase: SupabaseClient,
	userId: string,
	id: string,
	status: "accepted" | "dismissed"
): Promise<void> {
	const { error } = await supabase
		.from("milestone_suggestions")
		.update({ status })
		.eq("id", id)
		.eq("user_id", userId);
	if (error) throw new Error(error.message);
}

/** Accepting adds a private milestone (the owner chooses what to make public). */
export async function acceptSuggestion(
	supabase: SupabaseClient,
	userId: string,
	suggestion: MilestoneSuggestion
): Promise<Milestone> {
	const milestone = await createMilestone(supabase, userId, {
		kind: suggestion.kind,
		title: suggestion.title,
		happened_on: suggestion.happened_on,
		visibility: "private",
		source: "suggested",
		source_ref: suggestion.source_ref,
	});
	await setSuggestionStatus(supabase, userId, suggestion.id, "accepted");
	return milestone;
}

// ==================== Public profile settings ====================

const SETTINGS_DEFAULTS: PublicProfileSettings = {
	public_handle: null,
	public_profile_enabled: false,
	search_indexing: false,
	open_to_roles: false,
};

export function toPublicSettings(row: Record<string, unknown> | null): PublicProfileSettings {
	if (!row) return { ...SETTINGS_DEFAULTS };
	return {
		public_handle: typeof row.public_handle === "string" ? row.public_handle : null,
		public_profile_enabled: row.public_profile_enabled === true,
		search_indexing: row.search_indexing === true,
		open_to_roles: row.open_to_roles === true,
	};
}

export async function loadPublicSettings(supabase: SupabaseClient, userId: string): Promise<PublicProfileSettings> {
	const { data, error } = await supabase
		.from("profiles")
		.select(PUBLIC_SETTINGS_COLUMNS)
		.eq("id", userId)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return toPublicSettings(data as Record<string, unknown> | null);
}

/** Why a settings change can't be saved, given the current values; null when fine. */
export function settingsProblem(current: PublicProfileSettings, update: PublicSettingsUpdate): string | null {
	const handle = update.public_handle === undefined ? current.public_handle : update.public_handle;
	const enabled = update.public_profile_enabled ?? current.public_profile_enabled;
	if (enabled && !handle) return "Pick a handle before turning on your public profile.";
	return null;
}

export type SaveSettingsResult = { settings: PublicProfileSettings } | { error: string; status: number };

export async function savePublicSettings(
	supabase: SupabaseClient,
	userId: string,
	update: PublicSettingsUpdate
): Promise<SaveSettingsResult> {
	const current = await loadPublicSettings(supabase, userId);
	const problem = settingsProblem(current, update);
	if (problem) return { error: problem, status: 400 };

	const { data, error } = await supabase
		.from("profiles")
		.update({ ...update, updated_at: new Date().toISOString() })
		.eq("id", userId)
		.select(PUBLIC_SETTINGS_COLUMNS)
		.maybeSingle();
	if (error?.code === UNIQUE_VIOLATION) return { error: "That handle is taken. Try another.", status: 409 };
	if (error) throw new Error(error.message);
	return { settings: toPublicSettings(data as Record<string, unknown> | null) };
}

// ==================== Public profile read ====================

export async function loadPublicProfile(supabase: SupabaseClient, handle: string): Promise<PublicProfile | null> {
	const { data, error } = await supabase.rpc("get_public_profile", { p_handle: handle });
	if (error) {
		console.error("[milestones] public profile read failed:", error.message);
		return null;
	}
	return parsePublicProfile(data);
}

// ==================== Owner views (preview and print) ====================

export type OwnerSummary = {
	fullName: string | null;
	headline: string | null;
	learning: PublicLearningEntry[];
};

async function loadOwnerLearning(supabase: SupabaseClient, userId: string): Promise<PublicLearningEntry[]> {
	const { data, error } = await supabase
		.from("learning_entries")
		.select("id, title, url, note, tags, created_at")
		.eq("user_id", userId)
		.eq("visibility", "public")
		.order("created_at", { ascending: false })
		.limit(50);
	if (error) return [];
	return parsePublicLearning(data);
}

function textOrNull(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Name, headline and shared learning for the owner's own preview (RLS: own rows). */
export async function loadOwnerSummary(supabase: SupabaseClient, userId: string): Promise<OwnerSummary> {
	const [profile, learning] = await Promise.all([
		supabase.from("profiles").select("full_name, headline").eq("id", userId).maybeSingle(),
		loadOwnerLearning(supabase, userId),
	]);
	const row = (profile.data ?? {}) as Record<string, unknown>;
	return { fullName: textOrNull(row.full_name), headline: textOrNull(row.headline), learning };
}
