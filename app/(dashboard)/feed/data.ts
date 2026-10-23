import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabaseServer";
import type { FeedSelection } from "@/lib/community/feeds";
import {
	hasPendingInviteRequest,
	loadFeed,
	loadLaunchField,
	loadMembership,
	loadPeopleAhead,
	loadThread,
	type PostThread,
} from "@/lib/community/server";
import type { CommunityMember, CommunityPost, PersonAhead } from "@/lib/community/types";

export type PageUser = { supabase: SupabaseClient; userId: string };

/** The signed-in user's RLS client and id, or a redirect to sign in. */
export async function requirePageUser(redirectTo = "/feed"): Promise<PageUser> {
	const supabase = createServerSupabase() as unknown as SupabaseClient;
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect(`/signin?redirect=${encodeURIComponent(redirectTo)}`);
	return { supabase, userId: user.id };
}

export type Gate =
	| Readonly<{ state: "member"; member: CommunityMember }>
	| Readonly<{ state: "outside"; launchField: string; suspended: boolean; requested: boolean }>
	| Readonly<{ state: "unavailable" }>;

/** Is this person an active member? If not, what the join screen needs. */
export async function loadGate({ supabase, userId }: PageUser): Promise<Gate> {
	try {
		const member = await loadMembership(supabase, userId);
		if (member?.status === "active") return { state: "member", member };
		const [launchField, requested] = await Promise.all([
			loadLaunchField(supabase),
			hasPendingInviteRequest(supabase, userId),
		]);
		return { state: "outside", launchField, suspended: member?.status === "suspended", requested };
	} catch (error) {
		console.error("[community] gate failed:", error);
		return { state: "unavailable" };
	}
}

export type FeedPageData = Readonly<{ posts: CommunityPost[]; people: PersonAhead[]; failed: boolean }>;

export async function loadFeedPage({ supabase, userId }: PageUser, selection: FeedSelection): Promise<FeedPageData> {
	const [feed, people] = await Promise.all([
		loadFeed(supabase, userId, selection).then(
			(posts) => ({ posts, failed: false }),
			(error: unknown) => {
				console.error("[community] feed failed:", error);
				return { posts: [] as CommunityPost[], failed: true };
			}
		),
		loadPeopleAhead(supabase),
	]);
	return { ...feed, people };
}

export async function loadThreadPage({ supabase, userId }: PageUser, postId: string): Promise<PostThread | null> {
	try {
		return await loadThread(supabase, userId, postId);
	} catch (error) {
		console.error("[community] thread failed:", error);
		return null;
	}
}
