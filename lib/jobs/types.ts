/** Job search / Job Inbox types shared by API routes and client components. */

export const JOB_SITES = [
	"linkedin",
	"naukri",
	"indeed",
	"glassdoor",
	"google",
	"zip_recruiter",
	"bayt",
	"bdjobs",
] as const;
export type JobSite = (typeof JOB_SITES)[number];

export const ATS_TYPES = ["greenhouse", "lever", "ashby"] as const;
export type AtsType = (typeof ATS_TYPES)[number];

export const MATCH_STATUSES = [
	"new",
	"shortlisted",
	"skipped",
	"applied",
	"expired",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export interface JobSearch {
	id: string;
	user_id: string;
	name: string;
	keywords: string[];
	include_keywords: string[];
	exclude_keywords: string[];
	locations: string[];
	sites: JobSite[];
	remote_ok: boolean;
	hours_old: number;
	results_wanted: number;
	enabled: boolean;
	created_at: string;
	updated_at: string;
}

export interface WatchedCompany {
	id: string;
	user_id: string;
	company: string;
	ats: AtsType;
	board_token: string;
	careers_url: string | null;
	enabled: boolean;
	created_at: string;
	updated_at: string;
}

/** One criterion of the LLM score (filled by rank_jobs). */
export interface LlmCriterion {
	score: number;
	note?: string;
}

/** job_matches.llm_reasons as written by rank_jobs (agent G contract). */
export interface LlmReasons {
	score?: number;
	reasons?: Partial<
		Record<
			| "skills_fit"
			| "seniority_fit"
			| "compensation"
			| "freshness"
			| "location_eligibility",
			LlmCriterion
		>
	>;
	summary?: string;
	red_flags?: string[];
	provider?: string;
	model?: string;
	key_source?: string;
	scored_at?: string;
	/** present when scoring failed (llm_score is then NULL) */
	error?: string;
	attempts?: number;
}

export interface DealBreaker {
	code: string;
	reason: string;
}

/** Row of the `job_inbox` view (job_matches + job_postings). */
export interface InboxRow {
	id: string;
	user_id: string;
	job_posting_id: string;
	search_id: string | null;
	prefilter_pass: boolean | null;
	similarity: number | null;
	llm_score: number | null;
	llm_reasons: LlmReasons | null;
	deal_breakers: DealBreaker[] | null;
	status: MatchStatus;
	company_id: string | null;
	seen_at: string | null;
	created_at: string;
	updated_at: string;
	source: string;
	url: string | null;
	title: string;
	company: string;
	location: string | null;
	is_remote: boolean | null;
	salary_min: number | null;
	salary_max: number | null;
	currency: string | null;
	salary_interval: string | null;
	posted_at: string | null;
	first_seen_at: string;
	last_seen_at: string;
	is_active: boolean;
	salary_top: number | null;
}

export interface JobDetail extends InboxRow {
	description: string | null;
}

export const CRITERION_LABELS: Record<string, string> = {
	skills_fit: "Skills fit",
	seniority_fit: "Seniority fit",
	compensation: "Compensation",
	freshness: "Freshness",
	location_eligibility: "Location / eligibility",
};

export function formatSalary(row: {
	salary_min: number | null;
	salary_max: number | null;
	currency: string | null;
}): string | null {
	const { salary_min: min, salary_max: max } = row;
	if (min == null && max == null) return null;
	const cur = row.currency || "";
	const fmt = (n: number) => {
		if (cur === "INR") {
			return n >= 100000 ? `${(n / 100000).toFixed(n % 100000 ? 1 : 0)}L` : n.toLocaleString("en-IN");
		}
		return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
	};
	const range =
		min != null && max != null && min !== max
			? `${fmt(Number(min))}–${fmt(Number(max))}`
			: fmt(Number(min ?? max));
	return `${cur ? cur + " " : ""}${range}/yr`;
}

/** Text for the companies.salary_range column. */
export function salaryRangeText(row: {
	salary_min: number | null;
	salary_max: number | null;
	currency: string | null;
}): string | null {
	return formatSalary(row);
}

export function mcpPrompt(row: { id: string; title: string; company: string }): string {
	return [
		`Using the OrbitHire MCP server, tailor my resume and write a cover letter for the job "${row.title}" at ${row.company}.`,
		`1. Call get_job with job_id "${row.id}" and get_profile.`,
		"2. Draft a truthful, ATS-friendly resume (no invented experience) following the tailor_resume prompt, then save it with save_resume linked to this job.",
		"3. Write a short cover letter following write_cover_letter and save it with save_cover_letter.",
		"4. Poll get_document until both PDFs are ready and give me the links.",
	].join("\n");
}
