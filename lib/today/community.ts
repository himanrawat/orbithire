import "server-only";

/**
 * Community preview for the Today page: three posts from the For you feed and three
 * people a few steps ahead. Members only; any failure leaves Today without it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFeed, loadMembership, loadPeopleAhead } from "@/lib/community/server";
import type { TodayCommunity } from "./types";

const PREVIEW_SIZE = 3;

export async function loadCommunityPreview(supabase: SupabaseClient, userId: string): Promise<TodayCommunity | null> {
	try {
		const member = await loadMembership(supabase, userId);
		if (member?.status !== "active") return null;
		const [posts, people] = await Promise.all([
			loadFeed(supabase, userId, { kind: "for-you", topic: null }),
			loadPeopleAhead(supabase, PREVIEW_SIZE),
		]);
		return {
			posts: posts
				.filter((post) => !post.hidden)
				.slice(0, PREVIEW_SIZE)
				.map((post) => ({
					id: post.id,
					type: post.type,
					title: post.title,
					authorName: post.author.displayName,
					helpfulCount: post.helpfulCount,
					replyCount: post.replyCount,
				})),
			people: people.slice(0, PREVIEW_SIZE),
		};
	} catch (error) {
		console.error("[today] community preview failed:", error);
		return null;
	}
}
