import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { MOCK_DURATION_MINUTES, MOCK_MAX_QUESTIONS, pickMockQuestions } from "@/lib/prep/mock";
import { listQuestions } from "@/lib/prep/server";
import { serverError } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prep/mock – a new 30-minute mock: an id and 3-4 mixed questions. */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		const pool = await listQuestions(auth.supabase, {});
		const questions = pickMockQuestions(pool, MOCK_MAX_QUESTIONS);
		return NextResponse.json({ mockId: randomUUID(), durationMinutes: MOCK_DURATION_MINUTES, questions });
	} catch (error) {
		return serverError("start mock", error, "Could not start a mock interview");
	}
}
