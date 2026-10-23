import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { serverError } from "@/lib/jobs/server";
import { isDuplicate, requireMember } from "@/lib/community/api";
import { enforceCommunityLimit } from "@/lib/community/server";
import { reportSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/community/reports – report a post, reply or member to the moderators. */
export async function POST(req: NextRequest) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, reportSchema);
	if (!parsed.success) return parsed.response;
	const limited = await enforceCommunityLimit("report", auth.user, auth.member);
	if (limited) return limited;

	const { targetType, targetId, reason, details } = parsed.data;
	const { error } = await auth.supabase.from("content_reports").insert({
		reporter_id: auth.user.id,
		target_type: targetType,
		target_id: targetId,
		reason,
		details: details || null,
	});
	// An open report from this person already exists: treat as received.
	if (error && !isDuplicate(error)) return serverError("Could not send your report", error);
	return NextResponse.json({ reported: true }, { status: 201 });
}
