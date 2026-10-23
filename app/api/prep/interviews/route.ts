import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { interviewCreateSchema } from "@/lib/prep/schema";
import { createInterview, listCompanyOptions, listInterviews } from "@/lib/prep/server";
import { serverError } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECENT_PAST_MS = 24 * 60 * 60 * 1000;

/** GET /api/prep/interviews – upcoming interview cards (and the last day) plus company options. */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		const since = new Date(Date.now() - RECENT_PAST_MS);
		const [interviews, companies] = await Promise.all([
			listInterviews(auth.supabase, auth.user.id, since),
			listCompanyOptions(auth.supabase, auth.user.id),
		]);
		return NextResponse.json({ interviews, companies });
	} catch (error) {
		return serverError("list interviews", error, "Could not load your interviews");
	}
}

/** POST /api/prep/interviews – add an interview card to one of the user's applications. */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, interviewCreateSchema);
	if (!parsed.success) return parsed.response;
	try {
		const interview = await createInterview(auth.supabase, auth.user.id, parsed.data);
		return NextResponse.json({ interview }, { status: 201 });
	} catch (error) {
		return serverError("create interview", error, "Could not save the interview. Check the application still exists.");
	}
}
