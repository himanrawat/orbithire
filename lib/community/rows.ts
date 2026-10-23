/** Narrowing database rows into Community view models. Pure, so it's unit-tested. */
import {
	isPostType,
	isTopic,
	type CommunityMember,
	type CommunityPost,
	type CommunityReply,
	type PersonAhead,
	type PostAuthor,
} from "./types";

export type Row = Record<string, unknown>;

export const POST_COLUMNS =
	"id, author_id, type, topic, title, body, url, helpful_count, reply_count, view_count, hidden, created_at";
export const REPLY_COLUMNS = "id, post_id, author_id, body, hidden, created_at";
export const MEMBER_COLUMNS = "user_id, field, display_name, headline, status, joined_at";

function str(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value : fallback;
}

function optionalStr(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function count(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function toMember(row: Row | null | undefined): CommunityMember | null {
	if (!row || typeof row.user_id !== "string") return null;
	return {
		userId: row.user_id,
		field: str(row.field),
		displayName: str(row.display_name, "Member"),
		status: row.status === "suspended" ? "suspended" : "active",
		joinedAt: str(row.joined_at),
	};
}

export function authorMap(rows: readonly Row[]): Map<string, PostAuthor> {
	return new Map(
		rows
			.filter((row) => typeof row.user_id === "string")
			.map((row) => [
				String(row.user_id),
				{ id: String(row.user_id), displayName: str(row.display_name, "Member"), headline: optionalStr(row.headline) },
			])
	);
}

const UNKNOWN_AUTHOR = (id: string): PostAuthor => ({ id, displayName: "Former member", headline: null });

export type ViewerContext = Readonly<{
	viewerId: string;
	authors: ReadonlyMap<string, PostAuthor>;
	helpful: ReadonlySet<string>;
	saved: ReadonlySet<string>;
	following: ReadonlySet<string>;
}>;

export type RankablePost = CommunityPost & { viewCount: number };

export function toPost(row: Row, ctx: ViewerContext): RankablePost | null {
	const id = optionalStr(row.id);
	const authorId = optionalStr(row.author_id);
	if (!id || !authorId || !isPostType(row.type) || !isTopic(row.topic)) return null;
	return {
		id,
		type: row.type,
		topic: row.topic,
		title: str(row.title),
		body: str(row.body),
		url: optionalStr(row.url),
		helpfulCount: count(row.helpful_count),
		replyCount: count(row.reply_count),
		viewCount: count(row.view_count),
		hidden: row.hidden === true,
		createdAt: str(row.created_at),
		author: ctx.authors.get(authorId) ?? UNKNOWN_AUTHOR(authorId),
		isOwn: authorId === ctx.viewerId,
		markedHelpful: ctx.helpful.has(id),
		saved: ctx.saved.has(id),
		followingAuthor: ctx.following.has(authorId),
	};
}

export function toPosts(rows: readonly Row[], ctx: ViewerContext): RankablePost[] {
	return rows.map((row) => toPost(row, ctx)).filter((post): post is RankablePost => post !== null);
}

export function toReply(row: Row, viewerId: string, authors: ReadonlyMap<string, PostAuthor>): CommunityReply | null {
	const id = optionalStr(row.id);
	const authorId = optionalStr(row.author_id);
	if (!id || !authorId) return null;
	return {
		id,
		body: str(row.body),
		hidden: row.hidden === true,
		createdAt: str(row.created_at),
		author: authors.get(authorId) ?? UNKNOWN_AUTHOR(authorId),
		isOwn: authorId === viewerId,
	};
}

export function toPersonAhead(row: Row): PersonAhead | null {
	const userId = optionalStr(row.user_id);
	if (!userId) return null;
	return {
		userId,
		displayName: str(row.display_name, "Member"),
		headline: optionalStr(row.headline),
		careerStage: optionalStr(row.career_stage),
	};
}

/** Distinct, non-empty string values of `key` across rows. */
export function idsOf(rows: readonly Row[], key: string): string[] {
	const ids = new Set<string>();
	for (const row of rows) {
		const value = row[key];
		if (typeof value === "string" && value) ids.add(value);
	}
	return [...ids];
}

/** Drops the internal view count before data reaches the client. */
export function publicPost(post: RankablePost): CommunityPost {
	const { viewCount, ...rest } = post;
	void viewCount;
	return rest;
}
