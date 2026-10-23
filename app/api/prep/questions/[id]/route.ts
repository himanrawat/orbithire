import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { getQuestion, listAttemptsForQuestion } from "@/lib/prep/server";
import { isUuid, notFound } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prep/questions/:id – the question and the user's recent attempts at it. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return notFound("Question");
	const [question, attempts] = await Promise.all([
		getQuestion(auth.supabase, params.id),
		listAttemptsForQuestion(auth.supabase, auth.user.id, params.id),
	]);
	if (!question) return notFound("Question");
	return NextResponse.json({ question, attempts });
}
