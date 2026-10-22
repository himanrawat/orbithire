import { NextRequest, NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/jobs/server";
import { MATCH_STATUSES, type MatchStatus } from "@/lib/jobs/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * GET /api/jobs – Job Inbox (job_inbox view, RLS: own matches).
 * Query: status (new|shortlisted|skipped|applied|expired, default new), source,
 * remote=1, min_salary, min_score, hidden=1 (show prefilter_pass=false rows),
 * offset.
 * Order: llm_score desc nulls last, similarity desc nulls last, posted_at desc.
 */
export async function GET(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { supabase, user } = auth;
	const q = req.nextUrl.searchParams;

	const status = (q.get("status") || "new") as MatchStatus;
	if (!MATCH_STATUSES.includes(status)) {
		return NextResponse.json({ error: "Invalid status" }, { status: 400 });
	}
	const source = q.get("source");
	const remote = q.get("remote") === "1";
	const minSalary = Number(q.get("min_salary") || 0);
	const minScore = Number(q.get("min_score") || 0);
	const showHidden = q.get("hidden") === "1";
	const offset = Math.max(0, Number(q.get("offset") || 0) | 0);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const applyFilters = (query: any) => {
		query = query.eq("user_id", user.id).eq("status", status);
		if (source) query = query.eq("source", source);
		if (remote) query = query.eq("is_remote", true);
		if (minSalary > 0) query = query.gte("salary_top", minSalary);
		if (minScore > 0) query = query.gte("llm_score", minScore);
		return query;
	};

	let list = applyFilters(
		supabase
			.from("job_inbox")
			.select("id,user_id,job_posting_id,search_id,prefilter_pass,similarity,llm_score,llm_reasons,deal_breakers,status,company_id,seen_at,created_at,updated_at,source,url,title,company,location,is_remote,salary_min,salary_max,currency,salary_interval,posted_at,first_seen_at,last_seen_at,is_active,salary_top")
	);
	list = showHidden
		? list.eq("prefilter_pass", false)
		: list.or("prefilter_pass.is.null,prefilter_pass.eq.true");
	list = list
		.order("llm_score", { ascending: false, nullsFirst: false })
		.order("similarity", { ascending: false, nullsFirst: false })
		.order("posted_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.range(offset, offset + PAGE_SIZE - 1);

	const hiddenQuery = applyFilters(
		supabase.from("job_inbox").select("id", { count: "exact", head: true })
	).eq("prefilter_pass", false);

	const countQueries = MATCH_STATUSES.map((s) =>
		supabase
			.from("job_matches")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("status", s)
	);

	const sourcesQuery = supabase
		.from("job_inbox")
		.select("source")
		.eq("user_id", user.id)
		.eq("status", status)
		.limit(1000);

	const [listRes, hiddenRes, sourcesRes, ...countRes] = await Promise.all([
		list,
		hiddenQuery,
		sourcesQuery,
		...countQueries,
	]);
	if (listRes.error) return serverError("Failed to load jobs", listRes.error);

	const counts: Record<string, number> = {};
	MATCH_STATUSES.forEach((s, i) => {
		counts[s] = countRes[i]?.count || 0;
	});
	const sources = Array.from(
		new Set(((sourcesRes.data as { source: string }[] | null) || []).map((r) => r.source))
	).sort();

	return NextResponse.json({
		jobs: listRes.data || [],
		hiddenCount: hiddenRes.count || 0,
		counts,
		sources,
		pageSize: PAGE_SIZE,
		offset,
	});
}
