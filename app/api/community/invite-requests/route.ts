import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser, serverError } from "@/lib/jobs/server";
import { isDuplicate } from "@/lib/community/api";
import { inviteRequestSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/community/invite-requests { note? } – ask for an invite. One request per person. */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, inviteRequestSchema);
	if (!parsed.success) return parsed.response;

	const { error } = await auth.supabase
		.from("community_invite_requests")
		.insert({ user_id: auth.user.id, note: parsed.data.note || null });
	if (error && !isDuplicate(error)) return serverError("Could not send your request", error);
	return NextResponse.json({ requested: true }, { status: 201 });
}
