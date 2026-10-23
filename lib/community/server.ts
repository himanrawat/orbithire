import "server-only";

/**
 * Server-side reads and guards for Community (PRD v2, area 6). Reads go through the
 * caller's RLS-scoped client, so field scoping, hidden content and block/mute filtering
 * are enforced by the database. Rate limits use the shared `consume_rate_limit` RPC,
 * keyed by user (not IP) so switching networks doesn't reset them.
 */
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { rankPosts } from "./ranking";
import { communityLimit, isNewAccount, type CommunityAction } from "./rateLimits";
import type { FeedSelection } from "./feeds";
import {
	MEMBER_COLUMNS,
	POST_COLUMNS,
	REPLY_COLUMNS,
	authorMap,
	idsOf,
	publicPost,
	toMember,
	toPersonAhead,
	toPosts,
	toReply,
	type RankablePost,
	type Row,
	type ViewerContext,
} from "./rows";
import {
	COMMUNITY_LIMITS,
	DEFAULT_LAUNCH_FIELD,
	type CommunityMember,
	type CommunityPost,
	type CommunityReply,
	type PersonAhead,
	type PostAuthor,
} from "./types";

type Db = SupabaseClient;

export async function loadMembership(supabase: Db, userId: string): Promise<CommunityMember | null> {
	const { data, error } = await supabase
		.from("community_members")
		.select(MEMBER_COLUMNS)
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return toMember(data as Row | null);
}

export async function loadLaunchField(supabase: Db): Promise<string> {
	const { data } = await supabase.from("community_settings").select("launch_field").eq("id", 1).maybeSingle();
	return typeof data?.launch_field === "string" ? data.launch_field : DEFAULT_LAUNCH_FIELD;
}

export async function hasPendingInviteRequest(supabase: Db, userId: string): Promise<boolean> {
	const { data } = await supabase
		.from("community_invite_requests")
		.select("status")
		.eq("user_id", userId)
		.maybeSingle();
	return data?.status === "pending";
}

// ==================== Viewer context ====================

async function loadAuthors(supabase: Db, authorIds: readonly string[]): Promise<Map<string, PostAuthor>> {
	if (authorIds.length === 0) return new Map();
	const { data } = await supabase
		.from("community_members")
		.select("user_id, display_name, headline")
		.in("user_id", authorIds as string[]);
	return authorMap((data ?? []) as Row[]);
}

async function loadOwnSet(supabase: Db, table: string, column: string, userId: string, ids: readonly string[]) {
	if (ids.length === 0) return new Set<string>();
	const { data } = await supabase
		.from(table)
		.select("post_id")
		.eq(column, userId)
		.in("post_id", ids as string[]);
	return new Set(idsOf((data ?? []) as Row[], "post_id"));
}

async function loadFollowing(supabase: Db, userId: string): Promise<Set<string>> {
	const { data } = await supabase.from("user_follows").select("followee_id").eq("follower_id", userId).limit(5000);
	return new Set(idsOf((data ?? []) as Row[], "followee_id"));
}

async function buildContext(supabase: Db, viewerId: string, rows: readonly Row[]): Promise<ViewerContext> {
	const postIds = idsOf(rows, "id");
	const [authors, helpful, saved, following] = await Promise.all([
		loadAuthors(supabase, idsOf(rows, "author_id")),
		loadOwnSet(supabase, "post_reactions", "user_id", viewerId, postIds),
		loadOwnSet(supabase, "post_saves", "user_id", viewerId, postIds),
		loadFollowing(supabase, viewerId),
	]);
	return { viewerId, authors, helpful, saved, following };
}

async function hydrate(supabase: Db, viewerId: string, rows: readonly Row[]): Promise<RankablePost[]> {
	if (rows.length === 0) return [];
	return toPosts(rows, await buildContext(supabase, viewerId, rows));
}

// ==================== Feeds ====================

function visiblePosts(supabase: Db) {
	return supabase.from("community_posts").select(POST_COLUMNS).eq("hidden", false);
}

async function rowsOrThrow(query: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
	const { data, error } = await query;
	if (error) throw new Error(error.message);
	return (data ?? []) as Row[];
}

async function forYouRows(supabase: Db) {
	const since = new Date(Date.now() - COMMUNITY_LIMITS.rankingWindowDays * 86_400_000).toISOString();
	return rowsOrThrow(
		visiblePosts(supabase)
			.gte("created_at", since)
			.order("created_at", { ascending: false })
			.limit(COMMUNITY_LIMITS.rankingPool)
	);
}

async function followingRows(supabase: Db, userId: string) {
	const following = [...(await loadFollowing(supabase, userId))];
	if (following.length === 0) return [];
	return rowsOrThrow(
		visiblePosts(supabase)
			.in("author_id", following)
			.order("created_at", { ascending: false })
			.limit(COMMUNITY_LIMITS.feedSize)
	);
}

async function savedRows(supabase: Db, userId: string) {
	const saves = await rowsOrThrow(
		supabase
			.from("post_saves")
			.select("post_id, created_at")
			.eq("user_id", userId)
			.order("created_at", { ascending: false })
			.limit(COMMUNITY_LIMITS.feedSize)
	);
	const order = idsOf(saves, "post_id");
	if (order.length === 0) return [];
	const rows = await rowsOrThrow(supabase.from("community_posts").select(POST_COLUMNS).in("id", order));
	const byId = new Map(rows.map((row) => [String(row.id), row]));
	return order.map((id) => byId.get(id)).filter((row): row is Row => row !== undefined);
}

async function mineRows(supabase: Db, userId: string) {
	return rowsOrThrow(
		supabase
			.from("community_posts")
			.select(POST_COLUMNS)
			.eq("author_id", userId)
			.order("created_at", { ascending: false })
			.limit(COMMUNITY_LIMITS.feedSize)
	);
}

async function topicRows(supabase: Db, topic: string) {
	return rowsOrThrow(
		visiblePosts(supabase).eq("topic", topic).order("created_at", { ascending: false }).limit(COMMUNITY_LIMITS.feedSize)
	);
}

function feedRows(supabase: Db, userId: string, selection: FeedSelection): Promise<Row[]> {
	switch (selection.kind) {
		case "topic":
			return topicRows(supabase, selection.topic);
		case "following":
			return followingRows(supabase, userId);
		case "saved":
			return savedRows(supabase, userId);
		case "mine":
			return mineRows(supabase, userId);
		default:
			return forYouRows(supabase);
	}
}

export async function loadFeed(supabase: Db, userId: string, selection: FeedSelection): Promise<CommunityPost[]> {
	const rows = await feedRows(supabase, userId, selection);
	const posts = await hydrate(supabase, userId, rows);
	const ordered = selection.kind === "for-you" ? rankPosts(posts, new Date(), COMMUNITY_LIMITS.feedSize) : posts;
	return ordered.map(publicPost);
}

// ==================== Post detail ====================

export type PostThread = Readonly<{ post: CommunityPost; replies: CommunityReply[] }>;

export async function loadThread(supabase: Db, userId: string, postId: string): Promise<PostThread | null> {
	const [postRows, replyRows] = await Promise.all([
		rowsOrThrow(supabase.from("community_posts").select(POST_COLUMNS).eq("id", postId).limit(1)),
		rowsOrThrow(
			supabase.from("community_replies").select(REPLY_COLUMNS).eq("post_id", postId).order("created_at").limit(500)
		),
	]);
	const [post] = await hydrate(supabase, userId, postRows);
	if (!post) return null;
	const authors = await loadAuthors(supabase, idsOf(replyRows, "author_id"));
	const replies = replyRows
		.map((row) => toReply(row, userId, authors))
		.filter((reply): reply is CommunityReply => reply !== null);
	return { post: publicPost(post), replies };
}

export async function loadPeopleAhead(supabase: Db, limit = 5): Promise<PersonAhead[]> {
	const { data, error } = await supabase.rpc("community_people_ahead", { p_limit: limit });
	if (error) {
		console.error("[community] people ahead failed:", error.message);
		return [];
	}
	return ((data ?? []) as Row[]).map(toPersonAhead).filter((person): person is PersonAhead => person !== null);
}

// ==================== Guards ====================

export type MemberAuth =
	| { error: NextResponse }
	| { error?: undefined; supabase: Db; user: User; member: CommunityMember };

/** For /api/community routes that need an active member. */
export async function requireActiveMember(supabase: Db, user: User): Promise<MemberAuth> {
	let member: CommunityMember | null;
	try {
		member = await loadMembership(supabase, user.id);
	} catch (error) {
		console.error("[community] membership lookup failed:", error);
		return { error: NextResponse.json({ error: "Community isn't available right now" }, { status: 503 }) };
	}
	if (!member) {
		return { error: NextResponse.json({ error: "Join the community with an invite first" }, { status: 403 }) };
	}
	if (member.status !== "active") {
		return { error: NextResponse.json({ error: "Your community access is paused" }, { status: 403 }) };
	}
	return { supabase, user, member };
}

function userKey(userId: string) {
	return createHash("sha256").update(`community:${userId}`).digest("hex");
}

/** Per-user daily limits, stricter for accounts or memberships under 7 days old. */
export async function enforceCommunityLimit(
	action: CommunityAction,
	user: Readonly<{ id: string; created_at?: string | null }>,
	member: CommunityMember
): Promise<NextResponse | null> {
	const limit = communityLimit(action, isNewAccount(user.created_at, member.joinedAt, new Date()));
	const { data, error } = await createServiceSupabase().rpc("consume_rate_limit", {
		p_key_hash: userKey(user.id),
		p_scope: limit.scope,
		p_limit: limit.limit,
		p_window_seconds: limit.windowSeconds,
	});
	if (error) {
		console.error("[community] rate limit check failed:", error.message);
		return NextResponse.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
	}
	const result = data as { allowed?: boolean; retry_after?: number } | null;
	if (result?.allowed) return null;
	return NextResponse.json(
		{ error: `You've reached today's limit of ${limit.limit}. Please try again tomorrow.` },
		{ status: 429, headers: { "Retry-After": String(Math.max(1, result?.retry_after ?? 3600)) } }
	);
}
