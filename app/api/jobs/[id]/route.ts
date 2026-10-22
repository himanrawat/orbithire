import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireUser, serverError } from "@/lib/jobs/server";
import { loadJob } from "@/lib/jobs/loadJob";
import { parseJson } from "@/lib/api";
import { jobMatchUpdateSchema } from "@/lib/schemas/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/:matchId – one Job Inbox entry with the full description.
// Marks the match as seen (seen_at) the first time.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		const job = await loadJob(auth.supabase, auth.user.id, params.id);
		if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
		if (!job.seen_at) {
			await auth.supabase
				.from("job_matches")
				.update({ seen_at: new Date().toISOString() })
				.eq("id", job.id)
				.eq("user_id", auth.user.id);
		}
		return NextResponse.json({ job });
	} catch (err) {
		return serverError("Failed to load job", err);
	}
}

// Users may move a match between these; 'applied' follows the linked
// application's status (DB trigger) and 'expired' is set by the fetcher.
const USER_STATUSES = ["new", "shortlisted", "skipped"] as const;

// PATCH /api/jobs/:matchId  { status: "shortlisted" | "skipped" | "new" }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, jobMatchUpdateSchema);
	if (!parsed.success) return parsed.response;
	const body = parsed.data;

	// { company_id }: link an application created elsewhere (the /generate flow).
	if ("company_id" in body) {
		const { data: company } = await auth.supabase
			.from("companies")
			.select("id, status")
			.eq("id", String(body.company_id))
			.eq("user_id", auth.user.id)
			.maybeSingle();
		if (!company) return badRequest("Unknown application");
		const applied = ["applied", "interviewing", "offered", "rejected"].includes(company.status);
		const { data, error } = await auth.supabase
			.from("job_matches")
			.update({ company_id: company.id, status: applied ? "applied" : "shortlisted" })
			.eq("id", params.id)
			.eq("user_id", auth.user.id)
			.select("id, status, company_id")
			.maybeSingle();
		if (error) return serverError("Failed to link application", error);
		if (!data) return NextResponse.json({ error: "Job not found" }, { status: 404 });
		return NextResponse.json({ match: data });
	}

	const status = "status" in body ? body.status : "";
	if (!(USER_STATUSES as readonly string[]).includes(status)) {
		return badRequest("status must be new, shortlisted or skipped");
	}
	const { data, error } = await auth.supabase
		.from("job_matches")
		.update({ status, seen_at: new Date().toISOString() })
		.eq("id", params.id)
		.eq("user_id", auth.user.id)
		.select("id, status")
		.maybeSingle();
	if (error) return serverError("Failed to update job", error);
	if (!data) return NextResponse.json({ error: "Job not found" }, { status: 404 });
	return NextResponse.json({ match: data });
}
