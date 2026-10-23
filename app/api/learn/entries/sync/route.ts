import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser, serverError } from "@/lib/jobs/server";
import { buildEntryInsert } from "@/lib/learn/entries";
import { logEntryBatchSchema, parseQueuedLogEntry, type QueuedLogEntry } from "@/lib/pwa/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIdOf(item: unknown) {
	const id = item && typeof item === "object" ? (item as { client_id?: unknown }).client_id : null;
	return typeof id === "string" ? id.slice(0, 64) : "unknown";
}

function splitEntries(items: readonly unknown[]) {
	const valid: QueuedLogEntry[] = [];
	const rejected: string[] = [];
	for (const item of items) {
		const parsed = parseQueuedLogEntry(item);
		if (parsed) valid.push(parsed);
		else rejected.push(clientIdOf(item));
	}
	return { valid, rejected };
}

function toRow(userId: string, entry: QueuedLogEntry) {
	const { client_id: clientId, ...input } = entry;
	// No server title fetch for synced links: the readable host/path fallback is used.
	return { ...buildEntryInsert(userId, input, null), client_id: clientId };
}

/**
 * POST /api/learn/entries/sync { entries: [...] } – the offline log outbox. One upsert,
 * idempotent by (user_id, client_id). Invalid items come back in `rejected`.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, logEntryBatchSchema);
	if (!parsed.success) return parsed.response;

	const { valid, rejected } = splitEntries(parsed.data.entries);
	if (valid.length > 0) {
		const { error } = await auth.supabase
			.from("learning_entries")
			.upsert(
				valid.map((entry) => toRow(auth.user.id, entry)),
				{ onConflict: "user_id,client_id", ignoreDuplicates: true }
			);
		if (error) return serverError("Could not sync your log entries", error);
	}
	return NextResponse.json({ synced: valid.map((entry) => entry.client_id), rejected });
}
