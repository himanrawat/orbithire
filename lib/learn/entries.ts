/** Pure builders for learning-log rows. No server imports. */
import type { CreateEntryInput, UpdateEntryInput } from "./schema";
import { LEARN_LIMITS, normalizeTags } from "./types";
import { fallbackTitle } from "./urlSafety";

function emptyToNull(value: string | undefined): string | null {
	return value && value.length > 0 ? value : null;
}

/** True when a link entry still needs its title fetched from the page. */
export function needsTitleFetch(input: CreateEntryInput): boolean {
	return input.kind === "link" && !input.title;
}

/**
 * The insert row for a new entry. `fetchedTitle` is the page title from the server fetch
 * (or null); link entries fall back to a readable host/path. Always private on creation.
 */
export function buildEntryInsert(userId: string, input: CreateEntryInput, fetchedTitle: string | null) {
	const tags = normalizeTags(input.tags ?? []);
	if (input.kind === "link") {
		const title = emptyToNull(input.title) ?? fetchedTitle ?? fallbackTitle(input.url);
		return {
			user_id: userId,
			kind: "link" as const,
			url: input.url,
			title: title.slice(0, LEARN_LIMITS.titleLength),
			note: emptyToNull(input.note),
			tags,
			visibility: "private" as const,
		};
	}
	return {
		user_id: userId,
		kind: "note" as const,
		url: null,
		title: emptyToNull(input.title),
		note: input.note,
		tags,
		visibility: "private" as const,
	};
}

/** The update for an existing entry; only fields present in the request are touched. */
export function buildEntryUpdate(input: UpdateEntryInput): Record<string, unknown> {
	const update: Record<string, unknown> = {};
	if (input.visibility !== undefined) update.visibility = input.visibility;
	if (input.title !== undefined) update.title = emptyToNull(input.title);
	if (input.note !== undefined) update.note = emptyToNull(input.note);
	if (input.tags !== undefined) update.tags = normalizeTags(input.tags);
	return update;
}

/** Progress row for a lesson status change. */
export function buildProgressRow(userId: string, lessonId: string, status: "in_progress" | "done", now: Date) {
	return {
		user_id: userId,
		lesson_id: lessonId,
		status,
		completed_at: status === "done" ? now.toISOString() : null,
	};
}
