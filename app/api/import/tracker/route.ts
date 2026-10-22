import { NextRequest, NextResponse } from "next/server";
import { getImportUser, loadUserCompanies } from "@/lib/import/server";
import { planTrackerImport, summarizePlan } from "@/lib/import/tracker";
import { parseJson } from "@/lib/api";
import { trackerImportSchema } from "@/lib/schemas/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/import/tracker
 * Body: { csv: string, mode: "preview" | "apply", skip?: number[] }
 *
 * preview: dry run, returns one row per CSV line with action create / update / skip.
 * apply:   recomputes the plan on the server (the client plan is never trusted),
 *          leaves out the row indexes in `skip`, then inserts / patches companies.
 * Dedupe key: (company name, job title), case-insensitive, per user.
 */
export async function POST(req: NextRequest) {
	const auth = await getImportUser();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { supabase, userId } = auth;

	const parsed = await parseJson(req, trackerImportSchema);
	if (!parsed.success) return parsed.response;
	const body = parsed.data;
	if (body.csv.length > MAX_CSV_BYTES) {
		return NextResponse.json({ error: "CSV is too large (max 2 MB)" }, { status: 413 });
	}
	if (!/(^|,)\s*company\s*(,|$)/im.test(body.csv.split(/\r?\n/, 1)[0] || "")) {
		return NextResponse.json(
			{ error: "This doesn't look like job_search_tracker.csv (no 'company' column in the header)" },
			{ status: 400 }
		);
	}

	let plan;
	try {
		plan = planTrackerImport(body.csv, await loadUserCompanies(supabase, userId));
	} catch (err) {
		return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 500 });
	}

	const rows = plan.map((p) => ({
		index: p.index,
		action: p.action,
		reason: p.reason,
		name: p.mapped.name,
		job_title: p.mapped.job_title,
		status: p.mapped.status,
		tracker_status: p.mapped.tracker_status,
		fit_rating: p.mapped.fit_rating,
		applied_at: p.mapped.applied_at,
		job_url: p.mapped.job_url,
		existing_id: p.existingId,
		fields: Object.keys(p.changes),
	}));

	if (body.mode !== "apply") {
		return NextResponse.json({ mode: "preview", summary: summarizePlan(plan), rows });
	}

	const skip = new Set(Array.isArray(body.skip) ? body.skip.filter((n): n is number => typeof n === "number") : []);
	const toCreate = plan.filter((p) => p.action === "create" && !skip.has(p.index));
	const toUpdate = plan.filter((p) => p.action === "update" && !skip.has(p.index));
	const result = { created: 0, updated: 0, skipped: plan.length - toCreate.length - toUpdate.length, errors: [] as string[] };

	if (toCreate.length) {
		const { data, error } = await supabase
			.from("companies")
			.insert(toCreate.map((p) => ({ ...p.changes, user_id: userId })))
			.select("id");
		if (error) result.errors.push(`Create failed: ${error.message}`);
		else result.created = data?.length ?? 0;
	}
	for (const p of toUpdate) {
		const { error } = await supabase
			.from("companies")
			.update({ ...p.changes, updated_at: new Date().toISOString() })
			.eq("id", p.existingId!)
			.eq("user_id", userId);
		if (error) result.errors.push(`${p.mapped.name}: ${error.message}`);
		else result.updated++;
	}

	return NextResponse.json({ mode: "apply", ...result }, { status: result.errors.length && !result.created && !result.updated ? 500 : 200 });
}
