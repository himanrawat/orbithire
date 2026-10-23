import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { localDateKey } from "@/lib/today/nextStep";
import { loadPlan, loadProfileBasics } from "@/lib/today/server";
import { openPlanCount } from "@/lib/pwa/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/today/badge → { count } open items in today's plan (the app icon badge). */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		const { timeZone } = await loadProfileBasics(auth.supabase, auth.user.id);
		const plan = await loadPlan(auth.supabase, auth.user.id, localDateKey(new Date(), timeZone));
		return NextResponse.json({ count: openPlanCount(plan?.items) }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("[today] badge failed:", error);
		return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });
	}
}
