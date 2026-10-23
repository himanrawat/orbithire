import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { attemptPatchSchema } from "@/lib/prep/schema";
import { flagAttemptWrong } from "@/lib/prep/server";
import { isUuid, notFound, serverError } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/prep/attempts/:id { flaggedWrong: true } – "This was wrong" on AI feedback. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return notFound("Attempt");
	const parsed = await parseJson(req, attemptPatchSchema);
	if (!parsed.success) return parsed.response;
	try {
		const attempt = await flagAttemptWrong(auth.supabase, auth.user.id, params.id);
		if (!attempt) return notFound("Attempt");
		return NextResponse.json({ attempt });
	} catch (error) {
		return serverError("flag attempt", error, "Could not send your report");
	}
}
