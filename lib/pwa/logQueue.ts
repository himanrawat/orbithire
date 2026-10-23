// Offline outbox for quick log entries (the bottom bar's Log (+) sheet). Entries saved while
// offline wait in localStorage and go to /api/learn/entries/sync, which is idempotent by
// client_id, when the browser is back online.

import { createOfflineQueue } from "@/lib/focus/offlineQueue";
import type { QueuedLogEntry } from "./schemas";

function isQueuedLogEntry(value: unknown): value is QueuedLogEntry {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	if (typeof v.client_id !== "string") return false;
	if (v.kind === "link") return typeof v.url === "string";
	return v.kind === "note" && typeof v.note === "string";
}

export const learnLogQueue = createOfflineQueue<QueuedLogEntry>({
	storageKey: "nm.learn.queue.v1",
	endpoint: "/api/learn/entries/sync",
	bodyField: "entries",
	keyOf: (entry) => entry.client_id,
	isItem: isQueuedLogEntry,
});
