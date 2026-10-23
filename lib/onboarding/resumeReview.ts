/**
 * Turns a /api/profile/extract result into review rows for onboarding. Nothing is saved
 * until the person ticks fields and confirms; the save goes through /api/import/profile.
 */

export type ReviewField = "full_name" | "location" | "experience_summary" | "skills" | "work_experience" | "education";

export type ReviewRow = Readonly<{
	field: ReviewField;
	label: string;
	/** what to show in the review list */
	preview: string;
	/** the value sent to /api/import/profile if ticked */
	value: unknown;
}>;

type Entry = Record<string, unknown>;

function text(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function entries(value: unknown): Entry[] {
	return Array.isArray(value) ? value.filter((v): v is Entry => typeof v === "object" && v !== null) : [];
}

function describeJobs(list: Entry[]): string {
	return list
		.slice(0, 3)
		.map((job) => [text(job.role), text(job.company)].filter(Boolean).join(" at "))
		.filter(Boolean)
		.join("; ");
}

function describeSchools(list: Entry[]): string {
	return list
		.slice(0, 3)
		.map((school) => [text(school.degree), text(school.institution)].filter(Boolean).join(", "))
		.filter(Boolean)
		.join("; ");
}

function moreSuffix(total: number, shown: number): string {
	return total > shown ? ` (+${total - shown} more)` : "";
}

function stringRow(field: ReviewField, label: string, value: string): ReviewRow | null {
	return value ? { field, label, preview: value, value } : null;
}

function listRow(field: ReviewField, label: string, list: Entry[], describe: (list: Entry[]) => string): ReviewRow | null {
	if (list.length === 0) return null;
	return { field, label, preview: `${describe(list)}${moreSuffix(list.length, 3)}`, value: list };
}

export function buildResumeReviewRows(extract: unknown): ReviewRow[] {
	const data = (typeof extract === "object" && extract !== null ? extract : {}) as Entry;
	const profile = (typeof data.profile === "object" && data.profile !== null ? data.profile : {}) as Entry;
	const skills = Array.isArray(data.skills) ? data.skills.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
	const rows = [
		stringRow("full_name", "Full name", text(profile.full_name)),
		stringRow("location", "Location", text(profile.location)),
		stringRow("experience_summary", "Summary", text(profile.summary)),
		skills.length ? { field: "skills" as const, label: "Skills", preview: skills.slice(0, 12).join(", ") + moreSuffix(skills.length, 12), value: skills } : null,
		listRow("work_experience", "Work experience", entries(data.work_experience), describeJobs),
		listRow("education", "Education", entries(data.education), describeSchools),
	];
	return rows.filter((row): row is ReviewRow => row !== null);
}

/** The body for /api/import/profile with only the ticked fields. */
export function selectedFields(rows: readonly ReviewRow[], selected: ReadonlySet<ReviewField>): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	for (const row of rows) {
		if (selected.has(row.field)) fields[row.field] = row.value;
	}
	return fields;
}

/** A role guess for the target-role field: the most recent job title, if any. */
export function suggestedRole(rows: readonly ReviewRow[]): string | null {
	const jobs = rows.find((row) => row.field === "work_experience")?.value;
	const first = entries(jobs)[0];
	const role = first ? text(first.role) : "";
	return role || null;
}
