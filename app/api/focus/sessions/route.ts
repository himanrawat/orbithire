import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { focusSessionBatchSchema, focusSessionSchema, type FocusSessionInput } from "@/lib/focus/schemas";
import { getWeeklyFocusSummary, insertFocusSessions, requireUser } from "@/lib/focus/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Valid sessions and the client_ids of the ones that can never be accepted. */
function splitSessions(items: readonly unknown[]) {
	const valid: FocusSessionInput[] = [];
	const rejected: string[] = [];
	for (const item of items) {
		const parsed = focusSessionSchema.safeParse(item);
		if (parsed.success) valid.push(parsed.data);
		else rejected.push(clientIdOf(item));
	}
	return { valid, rejected };
}

function clientIdOf(item: unknown) {
	const id = item && typeof item === "object" ? (item as { client_id?: unknown }).client_id : null;
	return typeof id === "string" ? id.slice(0, 64) : "unknown";
}

function parseWeekStart(value: string | null) {
	if (!value) return undefined;
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? undefined : new Date(ms);
}

/**
 * POST /api/focus/sessions { sessions: [...] } – the offline outbox's batch sync. Idempotent
 * by client_id. Invalid items are reported in `rejected` and dropped by the client.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	const parsed = await parseJson(req, focusSessionBatchSchema);
	if (!parsed.success) return parsed.response;

	const { valid, rejected } = splitSessions(parsed.data.sessions);
	try {
		await insertFocusSessions(auth.supabase, auth.userId, valid);
	} catch {
		return NextResponse.json({ error: "Could not save focus sessions" }, { status: 500 });
	}
	return NextResponse.json({ synced: valid.map((s) => s.client_id), rejected });
}

/** GET /api/focus/sessions?weekStart=ISO → this week's focus total against the goal. */
export async function GET(req: NextRequest) {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	const weekStart = parseWeekStart(req.nextUrl.searchParams.get("weekStart"));
	const summary = await getWeeklyFocusSummary(auth.userId, { supabase: auth.supabase, weekStart });
	return NextResponse.json({ summary });
}
