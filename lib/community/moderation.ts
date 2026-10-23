/**
 * Pure helpers for the actionable moderation queue (PRD v2, areas 6 and 12): narrowing
 * report rows, building a preview of the reported content, and deciding what each
 * moderator action changes.
 */
import type { ModerationAction } from "./schema";
import type { ReportTarget } from "./types";

type Row = Record<string, unknown>;

export type TargetPreview = Readonly<{
	/** Post title, reply excerpt or member name. */
	headline: string;
	excerpt: string | null;
	authorId: string | null;
	authorName: string | null;
	hidden: boolean;
	suspended: boolean;
	missing: boolean;
}>;

export type QueueReport = Readonly<{
	id: string;
	reason: string;
	details: string | null;
	status: string;
	targetType: ReportTarget;
	targetId: string;
	createdAt: string | null;
	preview: TargetPreview;
}>;

function str(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function excerpt(value: unknown, max = 280): string | null {
	const text = str(value);
	if (!text) return null;
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function isTarget(value: unknown): value is ReportTarget {
	return value === "post" || value === "reply" || value === "user";
}

export type PreviewSources = Readonly<{
	posts: ReadonlyMap<string, Row>;
	replies: ReadonlyMap<string, Row>;
	members: ReadonlyMap<string, Row>;
}>;

const MISSING: TargetPreview = {
	headline: "Content was deleted",
	excerpt: null,
	authorId: null,
	authorName: null,
	hidden: false,
	suspended: false,
	missing: true,
};

function memberInfo(members: PreviewSources["members"], userId: string | null) {
	const member = userId ? members.get(userId) : undefined;
	return { name: str(member?.display_name), suspended: member?.status === "suspended" };
}

function contentPreview(row: Row | undefined, members: PreviewSources["members"], headline: (row: Row) => string) {
	if (!row) return MISSING;
	const authorId = str(row.author_id);
	const author = memberInfo(members, authorId);
	return {
		headline: headline(row),
		excerpt: excerpt(row.body),
		authorId,
		authorName: author.name,
		hidden: row.hidden === true,
		suspended: author.suspended,
		missing: false,
	};
}

export function buildPreview(targetType: ReportTarget, targetId: string, sources: PreviewSources): TargetPreview {
	if (targetType === "post") {
		return contentPreview(sources.posts.get(targetId), sources.members, (row) => str(row.title) ?? "Untitled post");
	}
	if (targetType === "reply") {
		return contentPreview(sources.replies.get(targetId), sources.members, () => "Reply");
	}
	const member = sources.members.get(targetId);
	if (!member) return { ...MISSING, headline: "Not a community member" };
	return {
		headline: str(member.display_name) ?? "Member",
		excerpt: excerpt(member.headline),
		authorId: targetId,
		authorName: str(member.display_name),
		hidden: false,
		suspended: member.status === "suspended",
		missing: false,
	};
}

export function toQueueReport(row: Row, sources: PreviewSources): QueueReport | null {
	const id = str(row.id);
	const targetId = str(row.target_id);
	if (!id || !targetId || !isTarget(row.target_type)) return null;
	return {
		id,
		reason: str(row.reason) ?? "other",
		details: excerpt(row.details, 1000),
		status: str(row.status) ?? "open",
		targetType: row.target_type,
		targetId,
		createdAt: str(row.created_at),
		preview: buildPreview(row.target_type, targetId, sources),
	};
}

export function byId(rows: readonly Row[], key = "id"): Map<string, Row> {
	return new Map(rows.filter((row) => typeof row[key] === "string").map((row) => [String(row[key]), row]));
}

// ==================== Actions ====================

export type ActionPlan =
	| Readonly<{ ok: false; error: string }>
	| Readonly<{
			ok: true;
			/** Table and id to hide, when the action hides content. */
			hide: Readonly<{ table: "community_posts" | "community_replies"; id: string }> | null;
			/** Member to suspend. */
			suspendUserId: string | null;
			status: "actioned" | "dismissed";
			resolution: "hidden" | "suspended" | "dismissed";
			/** Close every open report on the same target, not just this one. */
			closeAllForTarget: boolean;
	  }>;

const HIDE_TABLE = { post: "community_posts", reply: "community_replies" } as const;

export function planAction(
	action: ModerationAction,
	report: Readonly<{ targetType: ReportTarget; targetId: string }>,
	authorId: string | null
): ActionPlan {
	if (action === "dismiss") {
		return { ok: true, hide: null, suspendUserId: null, status: "dismissed", resolution: "dismissed", closeAllForTarget: false };
	}
	if (action === "hide") {
		if (report.targetType === "user") return { ok: false, error: "Members can't be hidden. Suspend them instead." };
		return {
			ok: true,
			hide: { table: HIDE_TABLE[report.targetType], id: report.targetId },
			suspendUserId: null,
			status: "actioned",
			resolution: "hidden",
			closeAllForTarget: true,
		};
	}
	const suspendUserId = report.targetType === "user" ? report.targetId : authorId;
	if (!suspendUserId) return { ok: false, error: "Couldn't find the member behind this report." };
	return { ok: true, hide: null, suspendUserId, status: "actioned", resolution: "suspended", closeAllForTarget: true };
}
