import { NextRequest, NextResponse } from "next/server";
import {
	badRequest,
	isSearchLimitError,
	parseSearchInput,
	requireUser,
	searchLimitReached,
	serverError,
} from "@/lib/jobs/server";
import { MAX_JOB_SEARCHES } from "@/lib/jobs/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/searches – the user's job searches.
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { data, error } = await auth.supabase
		.from("job_searches")
		.select("*")
		.eq("user_id", auth.user.id)
		.order("created_at", { ascending: true });
	if (error) return serverError("Failed to load searches", error);
	return NextResponse.json({ searches: data || [], limit: MAX_JOB_SEARCHES });
}

// POST /api/jobs/searches – create a job search (max MAX_JOB_SEARCHES per user;
// 409 {code: "search_limit"} beyond that – the DB trigger enforces it too).
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
	const { data: input, error: inputError } = parseSearchInput(body, false);
	if (inputError) return badRequest(inputError);
	const { count, error: countError } = await auth.supabase
		.from("job_searches")
		.select("id", { count: "exact", head: true })
		.eq("user_id", auth.user.id);
	if (countError) return serverError("Failed to create search", countError);
	if ((count ?? 0) >= MAX_JOB_SEARCHES) return searchLimitReached();
	const { data, error } = await auth.supabase
		.from("job_searches")
		.insert({ ...input, user_id: auth.user.id })
		.select("*")
		.single();
	if (error) {
		if (isSearchLimitError(error)) return searchLimitReached();
		return serverError("Failed to create search", error);
	}
	return NextResponse.json({ search: data }, { status: 201 });
}
