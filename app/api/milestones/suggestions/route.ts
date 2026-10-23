import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { jsonError, refreshAndListSuggestions } from "@/lib/milestones/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/milestones/suggestions → { suggestions }. Builds pending suggestions from events
 * (offers in Companies, finished learning paths, finished public learning entries) first.
 */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		return NextResponse.json({ suggestions: await refreshAndListSuggestions(auth.supabase, auth.user.id) });
	} catch (error) {
		console.error("[milestones] suggestions failed:", error);
		return jsonError("Could not load suggestions", 500);
	}
}
