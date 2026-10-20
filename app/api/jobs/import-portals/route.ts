import { NextRequest, NextResponse } from "next/server";
import { badRequest, isSearchLimitError, requireUser, serverError } from "@/lib/jobs/server";
import { IMPORTED_SEARCH_NAME, parsePortalsYaml } from "@/lib/jobs/portals";

export const runtime = "nodejs";

const MAX_BYTES = 512 * 1024;

/**
 * POST /api/jobs/import-portals (multipart, field "file") – import a career-ops portals.yml.
 *
 * - tracked_companies with a Greenhouse / Lever / Ashby board (from `api` or
 *   `careers_url`) -> watched_companies (upsert on user+ats+board_token).
 *   Others are reported as skipped.
 * - title_filter.positive / negative -> a job_search "Default (imported from
 *   portals.yml)": keywords = first 3 positive, include_keywords = all positive,
 *   exclude_keywords = negative, locations India, sites linkedin + naukri.
 *   Re-importing updates that search's keyword lists.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { supabase, user } = auth;

	let text: string;
	try {
		const form = await req.formData();
		const file = form.get("file");
		if (!file || typeof file === "string") return badRequest("Upload a portals.yml file");
		if (file.size > MAX_BYTES) return badRequest("File too large (max 512 KB)");
		text = await file.text();
	} catch {
		return badRequest("Expected multipart/form-data with a file");
	}

	let cfg;
	try {
		cfg = parsePortalsYaml(text);
	} catch (err) {
		return badRequest(`Could not parse YAML: ${err instanceof Error ? err.message : String(err)}`);
	}
	if (!cfg.companies.length && !cfg.positive.length) {
		return badRequest("No tracked_companies or title_filter found in this file");
	}

	try {
		const importable = cfg.companies.filter((c) => c.ats && c.board_token);
		const skipped = cfg.companies.filter((c) => !c.ats || !c.board_token).map((c) => c.company);

		const { data: existing } = await supabase
			.from("watched_companies")
			.select("ats, board_token")
			.eq("user_id", user.id);
		const existingKeys = new Set((existing || []).map((r) => `${r.ats}:${r.board_token}`));

		if (importable.length) {
			const { error } = await supabase.from("watched_companies").upsert(
				importable.map((c) => ({
					user_id: user.id,
					company: c.company,
					ats: c.ats,
					board_token: c.board_token,
					careers_url: c.careers_url,
					enabled: c.enabled,
				})),
				{ onConflict: "user_id,ats,board_token" }
			);
			if (error) return serverError("Failed to import companies", error);
		}
		const added = importable.filter((c) => !existingKeys.has(`${c.ats}:${c.board_token}`)).length;

		let search: { id: string; created: boolean } | null = null;
		// Set when the user is already at the job-search limit: the companies are
		// still imported, only the default search is not created.
		let searchSkipped: string | null = null;
		if (cfg.positive.length) {
			const fields = {
				keywords: cfg.positive.slice(0, 3),
				include_keywords: cfg.positive,
				exclude_keywords: cfg.negative,
			};
			const { data: current } = await supabase
				.from("job_searches")
				.select("id")
				.eq("user_id", user.id)
				.eq("name", IMPORTED_SEARCH_NAME)
				.maybeSingle();
			if (current) {
				const { error } = await supabase.from("job_searches").update(fields).eq("id", current.id);
				if (error) return serverError("Failed to update search", error);
				search = { id: current.id, created: false };
			} else {
				const { data, error } = await supabase
					.from("job_searches")
					.insert({
						user_id: user.id,
						name: IMPORTED_SEARCH_NAME,
						...fields,
						locations: ["India"],
						sites: ["linkedin", "naukri"],
						results_wanted: 20,
					})
					.select("id")
					.single();
				if (isSearchLimitError(error)) {
					searchSkipped = "You already have the maximum number of job searches, so the default search was not created.";
				} else if (error || !data) {
					return serverError("Failed to create search", error);
				} else {
					search = { id: data.id, created: true };
				}
			}
		}

		return NextResponse.json({
			companiesAdded: added,
			companiesUpdated: importable.length - added,
			companiesSkipped: skipped,
			search,
			searchSkipped,
			positive: cfg.positive.length,
			negative: cfg.negative.length,
		});
	} catch (err) {
		return serverError("Import failed", err);
	}
}
