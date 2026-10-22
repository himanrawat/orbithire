/**
 * ai-job-search `job_search_tracker.csv` -> NextMilestone `companies` (applications).
 *
 * Pure functions (no I/O) so the API route, the UI preview and the test script
 * share them. The Python CLI (worker/orbithire_worker/import_legacy.py) mirrors
 * these rules; keep both in sync (tests: scripts/test-import.ts, worker/tests/test_import_legacy.py).
 *
 * Tracker header (2026-10):
 *   date,company,sector,role,role_type,channel,status,contact_person,fit_rating,
 *   notes,cv_file,cover_letter_file,source,deadline
 */
import { parseCsvObjects } from "./csv";

export type AppStatus = "saved" | "applied" | "interviewing" | "offered" | "rejected" | "withdrawn";

export const IMPORT_MARKER = "Imported from job_search_tracker.csv";

/** Tracker vocabulary (ai-job-search /outcome) -> companies.status */
const STATUS_MAP: Record<string, AppStatus> = {
	drafted: "saved",
	draft: "saved",
	saved: "saved",
	applied: "applied",
	submitted: "applied",
	interview: "interviewing",
	interviewing: "interviewing",
	interview_only: "interviewing",
	offer: "offered",
	offered: "offered",
	hired: "offered",
	rejected: "rejected",
	no_response: "rejected",
	offer_declined: "withdrawn",
	withdrawn: "withdrawn",
};

/** Pipeline order; an import never moves an application backwards. */
const STATUS_RANK: Record<AppStatus, number> = {
	saved: 0,
	applied: 1,
	interviewing: 2,
	offered: 3,
	rejected: 4,
	withdrawn: 4,
};

export function mapTrackerStatus(raw: string | undefined | null): { status: AppStatus; known: boolean } {
	const key = (raw || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
	const status = STATUS_MAP[key];
	return status ? { status, known: true } : { status: "saved", known: false };
}

export interface MappedCompany {
	name: string;
	job_title: string | null;
	job_url: string | null;
	industry: string | null;
	recruiter_name: string | null;
	status: AppStatus;
	applied_at: string | null;
	notes: string;
	/** Tracker extras kept for matching PDFs and for the preview table. */
	fit_rating: number | null;
	cv_file: string | null;
	cover_letter_file: string | null;
	tracker_status: string;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Map one tracker row. Returns null for rows without a company name. */
export function mapTrackerRow(row: Record<string, string>): MappedCompany | null {
	const get = (k: string) => (row[k] ?? "").trim();
	const name = get("company");
	if (!name) return null;
	const trackerStatus = get("status");
	const { status, known } = mapTrackerStatus(trackerStatus);
	const date = get("date");
	const fitRaw = get("fit_rating");
	const fit = fitRaw && !Number.isNaN(Number(fitRaw)) ? Number(fitRaw) : null;
	const source = get("source");

	const lines: string[] = [IMPORT_MARKER];
	if (fit !== null) lines.push(`Fit rating: ${fit}`);
	if (trackerStatus) lines.push(`Tracker status: ${trackerStatus}${known ? "" : " (unrecognised, imported as saved)"}`);
	if (date) lines.push(`Tracked on: ${date}`);
	if (get("role_type")) lines.push(`Role type: ${get("role_type")}`);
	if (get("channel")) lines.push(`Channel: ${get("channel")}`);
	if (get("deadline")) lines.push(`Deadline: ${get("deadline")}`);
	if (source && !isUrl(source)) lines.push(`Source: ${source}`);
	if (get("cv_file")) lines.push(`CV file: ${get("cv_file")}`);
	if (get("cover_letter_file")) lines.push(`Cover letter file: ${get("cover_letter_file")}`);
	const notes = get("notes");

	return {
		name,
		job_title: get("role") || null,
		job_url: source && isUrl(source) ? source : null,
		industry: get("sector") || null,
		recruiter_name: get("contact_person") || null,
		status,
		// The tracker's `date` means "applied on" once a row leaves `drafted`.
		applied_at: status !== "saved" && DATE_RE.test(date) ? `${date}T00:00:00.000Z` : null,
		notes: notes ? `${lines.join("\n")}\n\n${notes}` : lines.join("\n"),
		fit_rating: fit,
		cv_file: get("cv_file") || null,
		cover_letter_file: get("cover_letter_file") || null,
		tracker_status: trackerStatus,
	};
}

export interface ExistingCompany {
	id: string;
	name: string;
	job_title: string | null;
	status: string | null;
	notes: string | null;
	job_url: string | null;
	industry: string | null;
	recruiter_name: string | null;
	applied_at: string | null;
}

export type ImportAction = "create" | "update" | "skip";

export interface TrackerPlanRow {
	index: number;
	action: ImportAction;
	reason: string;
	mapped: MappedCompany;
	existingId: string | null;
	/** Fields to insert (create) or patch (update). */
	changes: Record<string, unknown>;
}

export const dedupeKey = (name: string, jobTitle: string | null | undefined) =>
	`${name.trim().toLowerCase().replace(/\s+/g, " ")}|${(jobTitle || "").trim().toLowerCase().replace(/\s+/g, " ")}`;

/** Decide create / update / skip for every tracker row, deduping on (name, job title). */
export function planTrackerImport(csvText: string, existing: ExistingCompany[]): TrackerPlanRow[] {
	const byKey = new Map(existing.map((c) => [dedupeKey(c.name, c.job_title), c]));
	const seen = new Set<string>();
	const plan: TrackerPlanRow[] = [];
	parseCsvObjects(csvText).forEach((row, index) => {
		const mapped = mapTrackerRow(row);
		if (!mapped) return;
		const key = dedupeKey(mapped.name, mapped.job_title);
		if (seen.has(key)) {
			plan.push({ index, action: "skip", reason: "Duplicate row in the CSV", mapped, existingId: null, changes: {} });
			return;
		}
		seen.add(key);
		const current = byKey.get(key);
		if (!current) {
			plan.push({
				index,
				action: "create",
				reason: "New application",
				mapped,
				existingId: null,
				changes: {
					name: mapped.name,
					job_title: mapped.job_title,
					job_url: mapped.job_url,
					industry: mapped.industry,
					recruiter_name: mapped.recruiter_name,
					status: mapped.status,
					applied_at: mapped.applied_at,
					notes: mapped.notes,
				},
			});
			return;
		}
		const patch: Record<string, unknown> = {};
		for (const f of ["job_url", "industry", "recruiter_name", "applied_at"] as const) {
			if (!current[f] && mapped[f]) patch[f] = mapped[f];
		}
		const curStatus = (current.status as AppStatus) || "saved";
		if ((STATUS_RANK[mapped.status] ?? 0) > (STATUS_RANK[curStatus] ?? 0)) patch.status = mapped.status;
		if (!(current.notes || "").includes(IMPORT_MARKER)) {
			patch.notes = current.notes ? `${current.notes}\n\n${mapped.notes}` : mapped.notes;
		}
		const fields = Object.keys(patch);
		plan.push({
			index,
			action: fields.length ? "update" : "skip",
			reason: fields.length ? `Fill in: ${fields.join(", ")}` : "Already imported, nothing to change",
			mapped,
			existingId: current.id,
			changes: patch,
		});
	});
	return plan;
}

export function summarizePlan(plan: { action: ImportAction }[]) {
	return {
		total: plan.length,
		create: plan.filter((p) => p.action === "create").length,
		update: plan.filter((p) => p.action === "update").length,
		skip: plan.filter((p) => p.action === "skip").length,
	};
}
