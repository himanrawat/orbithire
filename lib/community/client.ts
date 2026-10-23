/** Browser-side calls to /api/community. Each throws an Error with a readable message. */
import type { PostType, RelationAction, ReportReason, ReportTarget, Topic } from "./types";

async function readError(response: Response, fallback: string) {
	const body = (await response.json().catch(() => null)) as { error?: string } | null;
	return body?.error ?? fallback;
}

async function send<T>(url: string, method: string, body: unknown, fallback: string): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (!response.ok) throw new Error(await readError(response, fallback));
	return (await response.json().catch(() => ({}))) as T;
}

export function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export function redeemInvite(code: string) {
	return send<{ field: string | null }>("/api/community/join", "POST", { code }, "Could not redeem this invite");
}

export function requestInvite(note: string) {
	const trimmed = note.trim();
	return send("/api/community/invite-requests", "POST", trimmed ? { note: trimmed } : {}, "Could not send your request");
}

export type PostDraft = { type: PostType; topic: Topic; title: string; body: string; url: string };

export function draftToBody(draft: PostDraft) {
	const body = draft.body.trim();
	const url = draft.url.trim();
	return {
		type: draft.type,
		topic: draft.topic,
		title: draft.title.trim(),
		...(body ? { body } : {}),
		...(url ? { url } : {}),
	};
}

export function createPost(draft: PostDraft) {
	return send<{ id: string }>("/api/community/posts", "POST", draftToBody(draft), "Could not publish this post");
}

export function deletePost(id: string) {
	return send(`/api/community/posts/${id}`, "DELETE", undefined, "Could not delete this post");
}

export function togglePost(id: string, kind: "helpful" | "save", on: boolean) {
	return send<{ on: boolean; helpfulCount: number | null }>(
		`/api/community/posts/${id}/toggle`,
		"POST",
		{ kind, on },
		"Could not update this post"
	);
}

export function createReply(postId: string, body: string) {
	return send<{ id: string }>(`/api/community/posts/${postId}/replies`, "POST", { body }, "Could not post your reply");
}

export function deleteReply(id: string) {
	return send(`/api/community/replies/${id}`, "DELETE", undefined, "Could not delete this reply");
}

export function reportContent(targetType: ReportTarget, targetId: string, reason: ReportReason, details: string) {
	const trimmed = details.trim();
	return send(
		"/api/community/reports",
		"POST",
		{ targetType, targetId, reason, ...(trimmed ? { details: trimmed } : {}) },
		"Could not send your report"
	);
}

export function updateRelation(action: RelationAction, userId: string) {
	return send("/api/community/relations", "POST", { action, userId }, "Could not update this member");
}

export async function recordViews(postIds: readonly string[]) {
	if (postIds.length === 0) return;
	try {
		await send("/api/community/views", "POST", { postIds: postIds.slice(0, 50) }, "");
	} catch {
		// Views only tune ranking; a failure is not worth surfacing.
	}
}
