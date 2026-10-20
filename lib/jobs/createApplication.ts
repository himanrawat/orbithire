/**
 * Server-only: "Create application" from a Job Inbox entry (job_matches.id).
 * Shared by POST /api/jobs/:matchId/application (RLS client) and the MCP
 * `create_application` tool (service-role client – every query below is
 * scoped to `userId` explicitly, so both are safe).
 *
 * Creates a `companies` row (the application) from the posting – name, job
 * title, job URL, salary range, JD – with status 'saved', starts follow-up
 * tracking the same way POST /api/companies does for a 'saved' application,
 * and links the match (job_matches.company_id) setting it to 'shortlisted'.
 * Idempotent: if the match is already linked to an existing application, that
 * one is returned with created = false.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadJob } from "./loadJob";
import { salaryRangeText, type JobDetail } from "./types";

export interface CreatedApplication {
	company: { id: string; name: string; status: string };
	created: boolean;
	job: JobDetail;
}

/** Returns null when the match does not exist for this user. Throws on DB errors. */
export async function createApplicationFromMatch(
	supabase: SupabaseClient,
	userId: string,
	matchId: string,
	opts: { notesSuffix?: string } = {}
): Promise<CreatedApplication | null> {
	const job = await loadJob(supabase, userId, matchId);
	if (!job) return null;

	if (job.company_id) {
		const { data: existing } = await supabase
			.from("companies")
			.select("id, name, status")
			.eq("id", job.company_id)
			.eq("user_id", userId)
			.maybeSingle();
		if (existing) return { company: existing, created: false, job };
	}

	const { data: company, error: companyError } = await supabase
		.from("companies")
		.insert({
			user_id: userId,
			name: job.company,
			status: "saved",
			job_title: job.title,
			job_description: job.description,
			job_url: job.url,
			salary_range: salaryRangeText(job),
			notes: `Created from Job Inbox (${job.source}${job.location ? `, ${job.location}` : ""})${
				opts.notesSuffix ? ` ${opts.notesSuffix}` : ""
			}.`,
		})
		.select("id, name, status")
		.single();
	if (companyError || !company) {
		throw new Error(`Failed to create application: ${companyError?.message ?? "no row"}`);
	}

	// Follow-up tracking – same rule as POST /api/companies for status 'saved'.
	const reminder = new Date();
	reminder.setDate(reminder.getDate() + 2);
	const { error: followUpError } = await supabase.from("follow_ups").insert({
		user_id: userId,
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
			.eq("id", company.id)
			.eq("user_id", userId);
	}

	const { error: linkError } = await supabase
		.from("job_matches")
		.update({
			company_id: company.id,
			status: job.status === "applied" ? "applied" : "shortlisted",
			seen_at: job.seen_at ?? new Date().toISOString(),
		})
		.eq("id", job.id)
		.eq("user_id", userId);
	if (linkError) console.error("[jobs] linking match failed:", linkError);

	return { company, created: true, job };
}
