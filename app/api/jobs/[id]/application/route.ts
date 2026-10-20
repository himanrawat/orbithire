import { NextRequest, NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/jobs/server";
import { loadJob } from "@/lib/jobs/loadJob";
import { salaryRangeText } from "@/lib/jobs/types";

export const runtime = "nodejs";

/**
 * POST /api/jobs/:matchId/application – "Create application" from a Job Inbox entry.
 *
 * Creates a `companies` row (the application) from the posting – name, job title,
 * job URL, salary range, JD – with status 'saved', starts follow-up tracking the
 * same way POST /api/companies does for a 'saved' application, and links the match
 * (job_matches.company_id) setting it to 'shortlisted'.
 *
 * Status rule: the match becomes 'applied' only when the application's status
 * moves to applied/interviewing/offered/rejected (DB trigger
 * companies_sync_job_match, migration 020). Idempotent: if the match is already
 * linked to an existing application, that one is returned.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { supabase, user } = auth;

	try {
		const job = await loadJob(supabase, user.id, params.id);
		if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

		if (job.company_id) {
			const { data: existing } = await supabase
				.from("companies")
				.select("id, name, status")
				.eq("id", job.company_id)
				.eq("user_id", user.id)
				.maybeSingle();
			if (existing) {
				return NextResponse.json({ company: existing, created: false });
			}
		}

		const { data: company, error: companyError } = await supabase
			.from("companies")
			.insert({
				user_id: user.id,
				name: job.company,
				status: "saved",
				job_title: job.title,
				job_description: job.description,
				job_url: job.url,
				salary_range: salaryRangeText(job),
				notes: `Created from Job Inbox (${job.source}${job.location ? `, ${job.location}` : ""}).`,
			})
			.select("id, name, status")
			.single();
		if (companyError || !company) {
			return serverError("Failed to create application", companyError);
		}

		// Follow-up tracking – same rule as POST /api/companies for status 'saved'.
		const reminder = new Date();
		reminder.setDate(reminder.getDate() + 2);
		const { error: followUpError } = await supabase.from("follow_ups").insert({
			user_id: user.id,
			company_id: company.id,
			sent_at: new Date().toISOString(),
			sent_method: "portal",
			next_reminder_at: reminder.toISOString(),
			status: "active",
			reminder_count: 1,
			message: "Submit your application",
		});
		if (followUpError) {
			console.error("[jobs] follow-up insert failed:", followUpError);
		} else {
			await supabase
				.from("companies")
				.update({ follow_up_date: reminder.toISOString() })
				.eq("id", company.id);
		}

		const { error: linkError } = await supabase
			.from("job_matches")
			.update({
				company_id: company.id,
				status: job.status === "applied" ? "applied" : "shortlisted",
				seen_at: job.seen_at ?? new Date().toISOString(),
			})
			.eq("id", job.id)
			.eq("user_id", user.id);
		if (linkError) console.error("[jobs] linking match failed:", linkError);

		return NextResponse.json({ company, created: true });
	} catch (err) {
		return serverError("Failed to create application", err);
	}
}
