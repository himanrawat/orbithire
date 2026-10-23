import { NextResponse, type NextRequest } from "next/server";
import { requireUser, badRequest } from "@/lib/jobs/server";
import { parseQuestionFilters } from "@/lib/prep/schema";
import { listQuestions } from "@/lib/prep/server";
import { serverError } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/prep/questions?role&topic&level&stage&companyType&mostAsked=true */
export async function GET(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const filters = parseQuestionFilters(req.nextUrl.searchParams);
	if (!filters) return badRequest("Unknown filter value");
	try {
		const questions = await listQuestions(auth.supabase, filters);
		return NextResponse.json({ questions });
	} catch (error) {
		return serverError("list questions", error, "Could not load questions");
	}
}
