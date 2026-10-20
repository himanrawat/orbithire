/** Job search / Job Inbox types shared by API routes and client components. */

/** JobSpy boards (job_searches.sites). */
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

/** Max job searches per user (also enforced by a DB trigger, migration 025). */
export const MAX_JOB_SEARCHES = 3;

export type CountryRegion = "india" | "uk" | "europe" | "north_america" | "apac";

export interface CountryOption {
	code: string; // ISO 3166-1 alpha-2
	name: string; // also the default location
	region: CountryRegion;
	glassdoor: boolean;
	adzuna: boolean;
}

/** Supported search countries – keep in sync with worker fetchers/countries.py. */
export const COUNTRIES: readonly CountryOption[] = [
	{ code: "IN", name: "India", region: "india", glassdoor: true, adzuna: true },
	{ code: "GB", name: "United Kingdom", region: "uk", glassdoor: true, adzuna: true },
	{ code: "IE", name: "Ireland", region: "europe", glassdoor: true, adzuna: false },
	{ code: "DE", name: "Germany", region: "europe", glassdoor: true, adzuna: true },
	{ code: "FR", name: "France", region: "europe", glassdoor: true, adzuna: true },
	{ code: "NL", name: "Netherlands", region: "europe", glassdoor: true, adzuna: true },
	{ code: "BE", name: "Belgium", region: "europe", glassdoor: true, adzuna: true },
	{ code: "AT", name: "Austria", region: "europe", glassdoor: true, adzuna: true },
	{ code: "CH", name: "Switzerland", region: "europe", glassdoor: true, adzuna: true },
	{ code: "ES", name: "Spain", region: "europe", glassdoor: true, adzuna: true },
	{ code: "IT", name: "Italy", region: "europe", glassdoor: true, adzuna: true },
	{ code: "PT", name: "Portugal", region: "europe", glassdoor: false, adzuna: false },
	{ code: "PL", name: "Poland", region: "europe", glassdoor: false, adzuna: true },
	{ code: "CZ", name: "Czechia", region: "europe", glassdoor: false, adzuna: false },
	{ code: "SE", name: "Sweden", region: "europe", glassdoor: false, adzuna: false },
	{ code: "DK", name: "Denmark", region: "europe", glassdoor: false, adzuna: false },
	{ code: "NO", name: "Norway", region: "europe", glassdoor: false, adzuna: false },
	{ code: "FI", name: "Finland", region: "europe", glassdoor: false, adzuna: false },
	{ code: "US", name: "United States", region: "north_america", glassdoor: true, adzuna: true },
	{ code: "CA", name: "Canada", region: "north_america", glassdoor: true, adzuna: true },
	{ code: "AU", name: "Australia", region: "apac", glassdoor: true, adzuna: true },
	{ code: "NZ", name: "New Zealand", region: "apac", glassdoor: true, adzuna: true },
	{ code: "SG", name: "Singapore", region: "apac", glassdoor: true, adzuna: true },
];
export const DEFAULT_COUNTRY = "IN";

export function countryByCode(code: string | null | undefined): CountryOption | undefined {
	const c = String(code || "").toUpperCase();
	return COUNTRIES.find((x) => x.code === (c === "UK" ? "GB" : c));
}

/** JobSpy boards that can be queried for a country (others: everywhere). */
export function siteAvailable(site: JobSite, country: string): boolean {
	const c = countryByCode(country);
	if (!c) return false;
	if (site === "naukri") return c.code === "IN";
	if (site === "zip_recruiter") return c.code === "US" || c.code === "CA";
	if (site === "glassdoor") return c.glassdoor;
	return true;
}

/** Job APIs (job_searches.sources) – keep in sync with worker fetchers/sources. */
export const API_SOURCE_IDS = [
	"adzuna",
	"jooble",
	"reed",
	"bundesagentur",
	"arbeitnow",
	"mycareersfuture",
	"usajobs",
	"remotive",
	"remoteok",
	"himalayas",
	"jobicy",
] as const;
export type ApiSource = (typeof API_SOURCE_IDS)[number];

export type SourceGroup = "Global" | "UK" | "Europe" | "Singapore" | "USA" | "Remote";

export interface ApiSourceInfo {
	id: ApiSource;
	label: string;
	group: SourceGroup;
	/** ISO-2 countries served; null = any country */
	countries: string[] | null;
	/** env vars the worker needs (empty = no key) */
	env: string[];
	remoteOnly: boolean;
	url: string;
}

export const API_SOURCES: readonly ApiSourceInfo[] = [
	{
		id: "adzuna",
		label: "Adzuna",
		group: "Global",
		countries: COUNTRIES.filter((c) => c.adzuna).map((c) => c.code),
		env: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
		remoteOnly: false,
		url: "https://www.adzuna.com",
	},
	{ id: "jooble", label: "Jooble", group: "Global", countries: null, env: ["JOOBLE_API_KEY"], remoteOnly: false, url: "https://jooble.org" },
	{ id: "reed", label: "Reed", group: "UK", countries: ["GB"], env: ["REED_API_KEY"], remoteOnly: false, url: "https://www.reed.co.uk" },
	{ id: "arbeitnow", label: "Arbeitnow", group: "Europe", countries: ["DE", "GB"], env: [], remoteOnly: false, url: "https://www.arbeitnow.com" },
	{
		id: "bundesagentur",
		label: "Bundesagentur für Arbeit",
		group: "Europe",
		countries: ["DE"],
		env: [],
		remoteOnly: false,
		url: "https://www.arbeitsagentur.de/jobsuche/",
	},
	{
		id: "mycareersfuture",
		label: "MyCareersFuture",
		group: "Singapore",
		countries: ["SG"],
		env: [],
		remoteOnly: false,
		url: "https://www.mycareersfuture.gov.sg",
	},
	{
		id: "usajobs",
		label: "USAJOBS",
		group: "USA",
		countries: ["US"],
		env: ["USAJOBS_API_KEY", "USAJOBS_USER_AGENT"],
		remoteOnly: false,
		url: "https://www.usajobs.gov",
	},
	{ id: "remotive", label: "Remotive", group: "Remote", countries: null, env: [], remoteOnly: true, url: "https://remotive.com" },
	{ id: "remoteok", label: "Remote OK", group: "Remote", countries: null, env: [], remoteOnly: true, url: "https://remoteok.com" },
	{ id: "himalayas", label: "Himalayas", group: "Remote", countries: null, env: [], remoteOnly: true, url: "https://himalayas.app" },
	{ id: "jobicy", label: "Jobicy", group: "Remote", countries: null, env: [], remoteOnly: true, url: "https://jobicy.com" },
];

export function sourceAvailable(id: string, country: string): boolean {
	const s = API_SOURCES.find((x) => x.id === id);
	if (!s || !countryByCode(country)) return false;
	return !s.countries || s.countries.includes(countryByCode(country)!.code);
}

/** Sensible defaults when a country is picked in the search form. */
export function defaultSitesFor(country: string): JobSite[] {
	const c = countryByCode(country)?.code || DEFAULT_COUNTRY;
	if (c === "IN") return ["linkedin", "naukri", "indeed"];
	return ["linkedin", "indeed"];
}

/**
 * Default API sources for a country: only the keyless ones (keyed sources such as
 * Adzuna / Reed / Jooble / USAJOBS are opt-in because the server may not have keys).
 */
export function defaultSourcesFor(country: string): ApiSource[] {
	const c = countryByCode(country)?.code || DEFAULT_COUNTRY;
	const byCountry: Record<string, ApiSource[]> = {
		GB: ["arbeitnow"],
		DE: ["bundesagentur", "arbeitnow"],
		SG: ["mycareersfuture"],
	};
	return [...(byCountry[c] || []), "himalayas", "remotive"];
}

export const ATS_TYPES = [
	"greenhouse",
	"lever",
	"ashby",
	"workable",
	"smartrecruiters",
	"recruitee",
	"personio",
	"teamtailor",
] as const;
export type AtsType = (typeof ATS_TYPES)[number];

/** Placeholder hint for the board token per ATS (watchlist form). */
export const ATS_TOKEN_HINTS: Record<AtsType, string> = {
	greenhouse: "boards.greenhouse.io/<token>",
	lever: "jobs.lever.co/<token>",
	ashby: "jobs.ashbyhq.com/<token>",
	workable: "apply.workable.com/<token>",
	smartrecruiters: "jobs.smartrecruiters.com/<CompanyId>",
	recruitee: "<token>.recruitee.com",
	personio: "<token>.jobs.personio.de",
	teamtailor: "<token>.teamtailor.com",
};

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
	sources: ApiSource[];
	country: string;
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
		"2. Draft a truthful, ATS-friendly resume (no invented experience) with tailor_resume, then save it with save_resume linked to this job.",
		"3. Write a short cover letter with write_cover_letter and save it with save_cover_letter.",
		"(The OrbitHire MCP server arrives in Phase 4; until then this prompt is a placeholder.)",
	].join("\n");
}
