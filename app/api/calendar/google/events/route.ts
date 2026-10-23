import { NextResponse, type NextRequest } from "next/server";
import { isGoogleCalendarConfigured } from "@/lib/calendar/google/config";
import { readGoogleEvents } from "@/lib/calendar/google/sync";
import { parseRange } from "@/lib/focus/schemas";
import { requireUser } from "@/lib/focus/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/calendar/google/events?start=ISO&end=ISO → { available, connected, events } (read-only) */
export async function GET(req: NextRequest) {
	const auth = await requireUser();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isGoogleCalendarConfigured()) return NextResponse.json({ available: false, connected: false, events: [] });
	const range = parseRange(req.nextUrl.searchParams);
	if (!range) return NextResponse.json({ error: "Send a start and end of at most 6 weeks" }, { status: 400 });
	const result = await readGoogleEvents(auth.userId, range);
	return NextResponse.json({ available: true, ...result });
}
