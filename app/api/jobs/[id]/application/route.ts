import { NextRequest, NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/jobs/server";
import { createApplicationFromMatch } from "@/lib/jobs/createApplication";

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
 *
 * Logic lives in lib/jobs/createApplication.ts (shared with the MCP tool).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { supabase, user } = auth;

	try {
		const result = await createApplicationFromMatch(supabase, user.id, params.id);
		if (!result) return NextResponse.json({ error: "Job not found" }, { status: 404 });
		return NextResponse.json({ company: result.company, created: result.created });
	} catch (err) {
		return serverError("Failed to create application", err);
	}
}
