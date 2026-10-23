import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { getQuestion, listAttemptsForQuestion, loadPrepAccess } from "@/lib/prep/server";
import { isUuid, notFound } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prep/questions/:id – the question, the user's recent attempts and their plan gates. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return notFound("Question");
	const [question, attempts, access] = await Promise.all([
		getQuestion(auth.supabase, params.id),
		listAttemptsForQuestion(auth.supabase, auth.user.id, params.id),
		loadPrepAccess(auth.supabase, auth.user.id),
	]);
	if (!question) return notFound("Question");
	return NextResponse.json({ question, attempts, access });
}
