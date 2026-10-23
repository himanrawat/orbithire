import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabaseServer";
import { loadEntries, loadLibrary, loadPaths, loadSkillGaps } from "@/lib/learn/server";
import type { LearningEntry, LibraryItem, PathSummary, SkillGap } from "@/lib/learn/types";

export type LearnPageData = Readonly<{
	entries: LearningEntry[];
	paths: PathSummary[];
	library: LibraryItem[];
	gaps: SkillGap[];
	matchCount: number;
	unavailable: boolean;
}>;

const EMPTY: LearnPageData = { entries: [], paths: [], library: [], gaps: [], matchCount: 0, unavailable: true };

/** The signed-in user's RLS client and id, or a redirect to sign in. */
export async function requirePageUser(): Promise<{ supabase: SupabaseClient; userId: string }> {
	const supabase = createServerSupabase() as unknown as SupabaseClient;
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin?redirect=/learn");
	return { supabase, userId: user.id };
}

async function loadSkillSection(supabase: SupabaseClient, userId: string, library: LibraryItem[]) {
	try {
		return await loadSkillGaps(supabase, userId, library);
	} catch (error) {
		console.error("[learn] skill gaps failed:", error);
		return { gaps: [], matchCount: 0 };
	}
}

/** Everything the Learn page shows. Falls back to an "unavailable" state before the migration runs. */
export async function loadLearnPage(supabase: SupabaseClient, userId: string): Promise<LearnPageData> {
	try {
		const [entries, paths, library] = await Promise.all([
			loadEntries(supabase, userId),
			loadPaths(supabase, userId),
			loadLibrary(supabase),
		]);
		const { gaps, matchCount } = await loadSkillSection(supabase, userId, library);
		return { entries, paths, library, gaps, matchCount, unavailable: false };
	} catch (error) {
		console.error("[learn] page data failed:", error);
		return EMPTY;
	}
}
