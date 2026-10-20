/**
 * Server-only: MCP rate limits per access token.
 *
 * - Requests: MCP_RATE_LIMIT_PER_MIN (default 60) per token per rolling minute,
 *   counted IN MEMORY in this Node process. That is exact for the single-VM
 *   deployment (one `next start`); with several instances each one allows the
 *   full budget, so move this to Postgres/Redis before scaling out.
 * - Writes: MCP_WRITE_LIMIT_PER_HOUR (default 20) per token per rolling hour,
 *   counted from user_activities (every MCP write tool logs an 'mcp.*' event
 *   with metadata.token_id), so it survives restarts and works across instances.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const envInt = (name: string, fallback: number) => {
	const n = Number(process.env[name]);
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const REQUESTS_PER_MINUTE = envInt("MCP_RATE_LIMIT_PER_MIN", 60);
export const WRITES_PER_HOUR = envInt("MCP_WRITE_LIMIT_PER_HOUR", 20);

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Record one request; returns retry-after seconds when over the limit. */
export function checkRequestRate(tokenId: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
	const recent = (hits.get(tokenId) || []).filter((t) => now - t < WINDOW_MS);
	if (recent.length >= REQUESTS_PER_MINUTE) {
		hits.set(tokenId, recent);
		return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)) };
	}
	recent.push(now);
	hits.set(tokenId, recent);
	// Keep the map small: drop idle tokens now and then.
	if (hits.size > 1000) {
		hits.forEach((list, key) => {
			if (!list.length || now - list[list.length - 1] > WINDOW_MS) hits.delete(key);
		});
	}
	return { ok: true };
}

/** Test helper. */
export function resetRequestRate() {
	hits.clear();
}

/** Writes made with this token in the last hour (from user_activities). */
export async function checkWriteRate(
	service: SupabaseClient,
	userId: string,
	tokenId: string
): Promise<{ ok: true; used: number } | { ok: false; used: number }> {
	const since = new Date(Date.now() - 3600_000).toISOString();
	const { count, error } = await service
		.from("user_activities")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.like("event_type", "mcp.%")
		.eq("metadata->>token_id", tokenId)
		.gte("created_at", since);
	if (error) {
		// Fail open on a counting error (the request limit still applies) but log it.
		console.error("[mcp] write-rate count failed:", error.message);
		return { ok: true, used: 0 };
	}
	const used = count ?? 0;
	return used >= WRITES_PER_HOUR ? { ok: false, used } : { ok: true, used };
}

/** Log an MCP write to user_activities (event_type 'mcp.<tool>'). Never throws. */
export async function logActivity(
	service: SupabaseClient,
	userId: string,
	eventType: string,
	metadata: Record<string, unknown>
): Promise<void> {
	const { error } = await service.from("user_activities").insert({
		user_id: userId,
		event_type: eventType,
		metadata,
	});
	if (error) console.error("[mcp] activity log failed:", error.message);
}
