import { describe, expect, it } from "vitest";
import { rankPosts, rankScore, ageInHours } from "@/lib/community/ranking";
import { feedHref, parseFeed, feedTitle } from "@/lib/community/feeds";
import { communityLimit, isNewAccount } from "@/lib/community/rateLimits";
import { authorMap, idsOf, publicPost, toMember, toPost, toPosts, type ViewerContext } from "@/lib/community/rows";
import { buildPreview, excerpt, planAction, toQueueReport, byId } from "@/lib/community/moderation";
import { createPostSchema, createInviteSchema, joinSchema, relationSchema, reportSchema } from "@/lib/community/schema";
import { draftToBody } from "@/lib/community/client";
import { EXPORT_TABLES } from "@/lib/account/export";

const NOW = new Date("2026-10-24T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("For you ranking", () => {
	it("prefers a higher helpful-per-view ratio at the same age", () => {
		const a = { helpfulCount: 40, viewCount: 100, replyCount: 0, createdAt: hoursAgo(5) };
		const b = { helpfulCount: 5, viewCount: 100, replyCount: 0, createdAt: hoursAgo(5) };
		expect(rankScore(a, NOW)).toBeGreaterThan(rankScore(b, NOW));
	});

	it("does not let one helpful out of one view beat a proven post", () => {
		const lucky = { helpfulCount: 1, viewCount: 1, replyCount: 0, createdAt: hoursAgo(2) };
		const proven = { helpfulCount: 40, viewCount: 100, replyCount: 0, createdAt: hoursAgo(2) };
		expect(rankScore(proven, NOW)).toBeGreaterThan(rankScore(lucky, NOW));
	});

	it("decays older posts", () => {
		const fresh = { helpfulCount: 10, viewCount: 50, replyCount: 0, createdAt: hoursAgo(1) };
		const old = { ...fresh, createdAt: hoursAgo(24 * 7) };
		expect(rankScore(fresh, NOW)).toBeGreaterThan(rankScore(old, NOW) * 5);
	});

	it("scores bad dates as zero and clamps negative counts", () => {
		expect(rankScore({ helpfulCount: 5, viewCount: 5, replyCount: 0, createdAt: "nope" }, NOW)).toBe(0);
		expect(ageInHours(hoursAgo(-3), NOW)).toBe(0);
		expect(rankScore({ helpfulCount: -5, viewCount: -1, replyCount: -2, createdAt: hoursAgo(0) }, NOW)).toBeCloseTo(0.1);
	});

	it("orders posts and breaks ties by recency, with a limit", () => {
		const posts = [
			{ id: "old", helpfulCount: 0, viewCount: 0, replyCount: 0, createdAt: hoursAgo(10) },
			{ id: "new", helpfulCount: 0, viewCount: 0, replyCount: 0, createdAt: hoursAgo(1) },
			{ id: "best", helpfulCount: 30, viewCount: 40, replyCount: 3, createdAt: hoursAgo(3) },
		];
		expect(rankPosts(posts, NOW).map((p) => p.id)).toEqual(["best", "new", "old"]);
		expect(rankPosts(posts, NOW, 1)).toHaveLength(1);
		expect(posts[0].id).toBe("old");
	});
});

describe("feed selection", () => {
	it("parses topics before feeds and falls back to For you", () => {
		expect(parseFeed({ topic: "interviews", feed: "saved" })).toEqual({ kind: "topic", topic: "interviews" });
		expect(parseFeed({ feed: "following" })).toEqual({ kind: "following", topic: null });
		expect(parseFeed({ feed: ["saved", "mine"] })).toEqual({ kind: "saved", topic: null });
		expect(parseFeed({ feed: "bogus", topic: "astrology" })).toEqual({ kind: "for-you", topic: null });
	});

	it("builds links and titles", () => {
		expect(feedHref({ kind: "for-you", topic: null })).toBe("/feed");
		expect(feedHref({ kind: "mine", topic: null })).toBe("/feed?feed=mine");
		expect(feedHref({ kind: "topic", topic: "system-design" })).toBe("/feed?topic=system-design");
		expect(feedTitle({ kind: "topic", topic: "system-design" })).toBe("System design");
	});
});

describe("new account rate limits", () => {
	it("treats young accounts or young memberships as new", () => {
		expect(isNewAccount(hoursAgo(24), hoursAgo(24 * 30), NOW)).toBe(true);
		expect(isNewAccount(hoursAgo(24 * 30), hoursAgo(24 * 2), NOW)).toBe(true);
		expect(isNewAccount(hoursAgo(24 * 30), hoursAgo(24 * 8), NOW)).toBe(false);
		expect(isNewAccount(null, "garbage", NOW)).toBe(false);
	});

	it("caps new members at 3 posts and 20 replies a day", () => {
		expect(communityLimit("post", true)).toMatchObject({ limit: 3, windowSeconds: 86_400, scope: "community.post.new" });
		expect(communityLimit("reply", true)).toMatchObject({ limit: 20, scope: "community.reply.new" });
		expect(communityLimit("post", false).limit).toBeGreaterThan(3);
		expect(communityLimit("post", false).scope).toBe("community.post.member");
	});
});

const ctx: ViewerContext = {
	viewerId: "me",
	authors: authorMap([{ user_id: "a1", display_name: "Alex", headline: "Senior engineer" }]),
	helpful: new Set(["p1"]),
	saved: new Set<string>(),
	following: new Set(["a1"]),
};

describe("row mapping", () => {
	it("maps a post with viewer state and hides the view count from the client", () => {
		const post = toPost(
			{
				id: "p1",
				author_id: "a1",
				type: "question",
				topic: "interviews",
				title: "How?",
				body: "",
				url: null,
				helpful_count: 4,
				reply_count: "2",
				view_count: 9,
				hidden: false,
				created_at: hoursAgo(1),
			},
			ctx
		);
		expect(post).toMatchObject({ author: { displayName: "Alex" }, markedHelpful: true, followingAuthor: true, replyCount: 2, isOwn: false });
		expect(post && "viewCount" in publicPost(post)).toBe(false);
	});

	it("drops invalid rows and labels unknown authors", () => {
		const posts = toPosts(
			[
				{ id: "x", author_id: "a1", type: "poll", topic: "interviews" },
				{ id: "y", author_id: "gone", type: "link", topic: "frontend", url: "https://example.com" },
			],
			ctx
		);
		expect(posts).toHaveLength(1);
		expect(posts[0].author.displayName).toBe("Former member");
	});

	it("narrows members and ids", () => {
		expect(toMember({ user_id: "u", field: "software engineering", status: "suspended", joined_at: "x" })?.status).toBe("suspended");
		expect(toMember(null)).toBeNull();
		expect(idsOf([{ id: "a" }, { id: "a" }, { id: "" }, { id: 3 }], "id")).toEqual(["a"]);
	});
});

describe("moderation", () => {
	const sources = {
		posts: byId([{ id: "p1", author_id: "a1", title: "Buy followers", body: "x".repeat(400), hidden: false }]),
		replies: byId([{ id: "r1", author_id: "a2", body: "rude", hidden: true }]),
		members: byId(
			[
				{ user_id: "a1", display_name: "Alex", status: "active" },
				{ user_id: "a2", display_name: "Blair", status: "suspended" },
			],
			"user_id"
		),
	};

	it("previews posts, replies, members and deleted content", () => {
		const post = buildPreview("post", "p1", sources);
		expect(post).toMatchObject({ headline: "Buy followers", authorId: "a1", authorName: "Alex", missing: false });
		expect(post.excerpt?.length).toBeLessThanOrEqual(280);
		expect(buildPreview("reply", "r1", sources)).toMatchObject({ hidden: true, suspended: true });
		expect(buildPreview("user", "a1", sources)).toMatchObject({ headline: "Alex", authorId: "a1" });
		expect(buildPreview("post", "nope", sources).missing).toBe(true);
		expect(excerpt("   ")).toBeNull();
	});

	it("builds queue rows and rejects malformed ones", () => {
		expect(toQueueReport({ id: "1", target_type: "post", target_id: "p1", reason: "spam" }, sources)?.preview.headline).toBe("Buy followers");
		expect(toQueueReport({ id: "2", target_type: "comment", target_id: "p1" }, sources)).toBeNull();
	});

	it("plans hide, suspend and dismiss", () => {
		const post = { targetType: "post" as const, targetId: "p1" };
		expect(planAction("hide", post, null)).toMatchObject({ ok: true, hide: { table: "community_posts", id: "p1" }, closeAllForTarget: true });
		expect(planAction("hide", { targetType: "reply", targetId: "r1" }, null)).toMatchObject({ hide: { table: "community_replies" } });
		expect(planAction("hide", { targetType: "user", targetId: "a1" }, "a1").ok).toBe(false);
		expect(planAction("suspend", post, "a1")).toMatchObject({ ok: true, suspendUserId: "a1", resolution: "suspended" });
		expect(planAction("suspend", { targetType: "user", targetId: "u9" }, null)).toMatchObject({ suspendUserId: "u9" });
		expect(planAction("suspend", post, null).ok).toBe(false);
		expect(planAction("dismiss", post, null)).toMatchObject({ status: "dismissed", closeAllForTarget: false, hide: null });
	});
});

describe("request schemas", () => {
	it("requires a link for link posts and valid topics", () => {
		expect(createPostSchema.safeParse({ type: "link", topic: "frontend", title: "Read this" }).success).toBe(false);
		expect(createPostSchema.safeParse({ type: "link", topic: "frontend", title: "Read this", url: "javascript:alert(1)" }).success).toBe(false);
		expect(createPostSchema.safeParse({ type: "question", topic: "astrology", title: "Hmm?" }).success).toBe(false);
		expect(createPostSchema.safeParse({ type: "milestone", topic: "career-growth", title: "Promoted to senior" }).success).toBe(true);
	});

	it("validates codes, reports, relations and invites", () => {
		expect(joinSchema.safeParse({ code: "abc-123!" }).success).toBe(false);
		expect(joinSchema.safeParse({ code: "ABCD1234" }).success).toBe(true);
		expect(reportSchema.safeParse({ targetType: "post", targetId: "not-a-uuid", reason: "spam" }).success).toBe(false);
		expect(relationSchema.safeParse({ action: "like", userId: "00000000-0000-4000-8000-000000000000" }).success).toBe(false);
		expect(createInviteSchema.safeParse({ maxUses: 0 }).success).toBe(false);
		expect(createInviteSchema.safeParse({ maxUses: 25, expiresInDays: 30 }).success).toBe(true);
	});

	it("trims drafts and omits empty optional fields", () => {
		expect(draftToBody({ type: "question", topic: "interviews", title: " Hi? ", body: "  ", url: "" })).toEqual({
			type: "question",
			topic: "interviews",
			title: "Hi?",
		});
	});
});

describe("account export", () => {
	it("includes the member's own community content", () => {
		const specs = new Map(EXPORT_TABLES.map((spec) => [spec.table, spec.ownerColumn]));
		expect(specs.get("community_posts")).toBe("author_id");
		expect(specs.get("community_replies")).toBe("author_id");
		expect(specs.get("post_reactions")).toBe("user_id");
		expect(specs.get("post_saves")).toBe("user_id");
	});
});
