/**
 * Self-serve data export (PRD area 11). Pure helpers: which tables are exported, how
 * secrets are stripped, and the printable HTML summary. The server side lives in
 * lib/account/server.ts.
 */

export type ExportTableSpec = Readonly<{
	table: string;
	/** Column that holds the owner's user id. */
	ownerColumn: "id" | "user_id";
	/** Columns never exported (credentials, encrypted values, share secrets). */
	omit?: readonly string[];
}>;

export const EXPORT_TABLES: readonly ExportTableSpec[] = [
	{ table: "profiles", ownerColumn: "id" },
	{ table: "user_settings", ownerColumn: "user_id", omit: ["ai_api_key_encrypted"] },
	{ table: "companies", ownerColumn: "user_id" },
	{ table: "resumes", ownerColumn: "user_id", omit: ["share_token"] },
	{ table: "cover_letters", ownerColumn: "user_id", omit: ["share_token"] },
	{ table: "document_versions", ownerColumn: "user_id" },
	{ table: "follow_ups", ownerColumn: "user_id" },
	{ table: "notifications", ownerColumn: "user_id" },
	{ table: "job_searches", ownerColumn: "user_id" },
	{ table: "watched_companies", ownerColumn: "user_id" },
	{ table: "job_matches", ownerColumn: "user_id" },
	{ table: "ranking_settings", ownerColumn: "user_id" },
	{ table: "ai_generations", ownerColumn: "user_id" },
	{ table: "daily_plans", ownerColumn: "user_id" },
	{ table: "subscriptions", ownerColumn: "user_id" },
	{ table: "milestones", ownerColumn: "user_id" },
	{ table: "milestone_suggestions", ownerColumn: "user_id" },
	{ table: "question_reports", ownerColumn: "user_id" },
	{ table: "practice_attempts", ownerColumn: "user_id" },
	{ table: "interviews", ownerColumn: "user_id" },
];

/** Upper bound per table, so one export request stays bounded. */
export const EXPORT_ROW_LIMIT = 5000;

export const EXPORT_FORMATS = ["json", "html"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ExportRow = Record<string, unknown>;

export type AccountExport = {
	exported_at: string;
	format_version: 1;
	account: { id: string; email: string | null };
	tables: Record<string, ExportRow[]>;
	/** Tables that could not be read; the rest of the export is still complete. */
	unavailable: string[];
};

export function parseExportFormat(value: string | null): ExportFormat | null {
	if (value === null || value === "") return "json";
	return (EXPORT_FORMATS as readonly string[]).includes(value)
		? (value as ExportFormat)
		: null;
}

export function stripOmittedColumns(
	rows: readonly ExportRow[],
	omit: readonly string[] = []
): ExportRow[] {
	if (omit.length === 0) return rows.map((row) => ({ ...row }));
	const hidden = new Set(omit);
	return rows.map((row) =>
		Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.has(key)))
	);
}

export function exportFilename(format: ExportFormat, now: Date): string {
	const day = now.toISOString().slice(0, 10);
	return `nextmilestone-export-${day}.${format}`;
}

// ==================== Printable summary ====================

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHtml(value: unknown): string {
	let text = "";
	if (typeof value === "string") text = value;
	else if (typeof value === "number" || typeof value === "boolean") text = String(value);
	return text.replaceAll(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

const US_DATE = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

export function formatUsDate(value: unknown): string {
	if (typeof value !== "string" || value === "") return "";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : US_DATE.format(date);
}

const TABLE_LABELS: Record<string, string> = {
	profiles: "Profile",
	user_settings: "Settings",
	companies: "Applications",
	resumes: "Resumes",
	cover_letters: "Cover letters",
	document_versions: "Document versions",
	follow_ups: "Follow-ups",
	notifications: "Notifications",
	job_searches: "Job searches",
	watched_companies: "Watched companies",
	job_matches: "Job matches",
	ranking_settings: "Ranking settings",
	ai_generations: "AI generations",
};

function tableLabel(table: string) {
	return TABLE_LABELS[table] ?? table;
}

function renderCountRows(tables: AccountExport["tables"]) {
	return Object.entries(tables)
		.map(
			([table, rows]) =>
				`<tr><td>${escapeHtml(tableLabel(table))}</td><td class="num">${rows.length}</td></tr>`
		)
		.join("");
}

function renderListSection(
	title: string,
	rows: readonly ExportRow[],
	columns: readonly (readonly [string, string])[]
) {
	if (rows.length === 0) return "";
	const head = columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("");
	const body = rows
		.map((row) => {
			const cells = columns.map(([key]) =>
				key.endsWith("_at") ? formatUsDate(row[key]) : escapeHtml(row[key])
			);
			const tds = cells.map((cell) => `<td>${cell}</td>`).join("");
			return `<tr>${tds}</tr>`;
		})
		.join("");
	return `<h2>${escapeHtml(title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

const PRINT_CSS = `body{font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;max-width:860px;margin:32px auto;padding:0 16px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}p.meta{color:#555;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top}
td.num{text-align:right}.note{background:#f5f5f5;padding:10px 12px;border-radius:6px;font-size:13px}
@media print{.note{display:none}body{margin:0}}`;

/** A self-contained page the user can print or save as PDF from the browser. */
export function renderExportSummaryHtml(data: AccountExport): string {
	const profile = data.tables.profiles?.[0] ?? {};
	const name = escapeHtml(profile.full_name) || "Your account";
	const sections = [
		renderListSection("Applications", data.tables.companies ?? [], [
			["name", "Company"],
			["job_title", "Role"],
			["status", "Status"],
			["created_at", "Added"],
		]),
		renderListSection("Resumes", data.tables.resumes ?? [], [
			["title", "Title"],
			["source", "Source"],
			["created_at", "Created"],
		]),
		renderListSection("Cover letters", data.tables.cover_letters ?? [], [
			["title", "Title"],
			["source", "Source"],
			["created_at", "Created"],
		]),
		renderListSection("AI generations", data.tables.ai_generations ?? [], [
			["feature", "Feature"],
			["model", "Model"],
			["prompt_version", "Prompt version"],
			["created_at", "Date"],
		]),
	].join("");
	const unavailable = data.unavailable.length
		? `<p class="meta">Not included (could not be read): ${escapeHtml(data.unavailable.map(tableLabel).join(", "))}</p>`
		: "";

	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NextMilestone data summary</title><style>${PRINT_CSS}</style></head><body>
<p class="note">To save this as a PDF, use your browser's Print command and choose "Save as PDF". The JSON export has every field.</p>
<h1>${name}</h1>
<p class="meta">${escapeHtml(data.account.email)} · Exported ${escapeHtml(formatUsDate(data.exported_at))} (UTC)</p>
${unavailable}
<h2>What we store</h2><table><thead><tr><th>Data</th><th class="num">Records</th></tr></thead><tbody>${renderCountRows(data.tables)}</tbody></table>
${sections}
</body></html>`;
}
