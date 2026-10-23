import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { interviewPatchSchema } from "@/lib/prep/schema";
import { deleteInterview, updateInterview } from "@/lib/prep/server";
import { isUuid, notFound, serverError } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

/** PATCH /api/prep/interviews/:id – date, round, company type, checklist or notes. */
export async function PATCH(req: NextRequest, { params }: Context) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return notFound("Interview");
	const parsed = await parseJson(req, interviewPatchSchema);
	if (!parsed.success) return parsed.response;
	try {
		const interview = await updateInterview(auth.supabase, auth.user.id, params.id, parsed.data);
		if (!interview) return notFound("Interview");
		return NextResponse.json({ interview });
	} catch (error) {
		return serverError("update interview", error, "Could not update the interview");
	}
}

/** DELETE /api/prep/interviews/:id */
export async function DELETE(_req: NextRequest, { params }: Context) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return notFound("Interview");
	try {
		const deleted = await deleteInterview(auth.supabase, auth.user.id, params.id);
		if (!deleted) return notFound("Interview");
		return NextResponse.json({ ok: true });
	} catch (error) {
		return serverError("delete interview", error, "Could not delete the interview");
	}
}
