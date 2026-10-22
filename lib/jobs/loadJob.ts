import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboxRow, JobDetail } from "./types";

/** Load one Job Inbox row (by job_matches.id) with the posting description. RLS applies. */
export async function loadJob(
	supabase: SupabaseClient,
	userId: string,
	matchId: string
): Promise<JobDetail | null> {
	if (!/^[0-9a-f-]{36}$/i.test(matchId)) return null;
	const { data: row, error } = await supabase
		.from("job_inbox")
		.select("id,user_id,job_posting_id,search_id,prefilter_pass,similarity,llm_score,llm_reasons,deal_breakers,status,company_id,seen_at,created_at,updated_at,source,url,title,company,location,is_remote,salary_min,salary_max,currency,salary_interval,posted_at,first_seen_at,last_seen_at,is_active,salary_top")
		.eq("id", matchId)
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new Error(error.message);
	if (!row) return null;
	const { data: posting } = await supabase
		.from("job_postings")
		.select("description")
		.eq("id", (row as InboxRow).job_posting_id)
		.maybeSingle();
	return { ...(row as InboxRow), description: (posting?.description as string | null) ?? null };
}
