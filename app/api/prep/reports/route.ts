import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { questionReportSchema } from "@/lib/prep/schema";
import { insertQuestionReport } from "@/lib/prep/server";
import { serverError } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/prep/reports – "I was asked this": a question from a real interview. */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, questionReportSchema);
	if (!parsed.success) return parsed.response;
	try {
		const id = await insertQuestionReport(auth.supabase, auth.user.id, parsed.data);
		return NextResponse.json({ id }, { status: 201 });
	} catch (error) {
		return serverError("report question", error, "Could not save your report");
	}
}
