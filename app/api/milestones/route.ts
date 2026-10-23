import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { milestoneCreateSchema } from "@/lib/milestones/schema";
import { createMilestone, jsonError, listMilestones } from "@/lib/milestones/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/milestones → { milestones } (the caller's timeline, newest first). */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		return NextResponse.json({ milestones: await listMilestones(auth.supabase, auth.user.id) });
	} catch (error) {
		console.error("[milestones] list failed:", error);
		return jsonError("Could not load your milestones", 500);
	}
}

/** POST /api/milestones → { milestone }. New milestones are private unless set otherwise. */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await parseJson(req, milestoneCreateSchema);
	if (!body.success) return body.response;
	try {
		const milestone = await createMilestone(auth.supabase, auth.user.id, { ...body.data, source: "manual" });
		return NextResponse.json({ milestone }, { status: 201 });
	} catch (error) {
		console.error("[milestones] create failed:", error);
		return jsonError("Could not save the milestone", 500);
	}
}
