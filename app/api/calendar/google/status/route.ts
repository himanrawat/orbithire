import { NextResponse } from "next/server";
import { isGoogleCalendarConfigured } from "@/lib/calendar/google/config";
import { getConnectionStatus } from "@/lib/calendar/google/connection";
import { requireUser } from "@/lib/focus/server";
import { canUse, getPlan } from "@/lib/billing/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/calendar/google/status → { available, connected, email, allowed } (allowed: plan includes sync) */
export async function GET() {
	const auth = await requireUser();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!isGoogleCalendarConfigured()) return NextResponse.json({ available: false, connected: false, email: null });
	const [status, plan] = await Promise.all([
		getConnectionStatus(auth.supabase, auth.userId),
		getPlan(auth.userId, auth.supabase),
	]);
	return NextResponse.json({ available: true, ...status, allowed: canUse(plan, "calendar_sync") });
}
