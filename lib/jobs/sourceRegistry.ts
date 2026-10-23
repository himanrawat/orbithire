/**
 * Job source registry: legal basis, attribution rules and production gates per source
 * (PRD area 9). Keep in sync with worker/orbithire_worker/fetchers/source_registry.py
 * and the `job_sources` table (migration 20261024000200_us_job_supply.sql).
 *
 * The worker skips `tosRestricted` sources unless ENABLE_TOS_RESTRICTED_SOURCES is on,
 * and `indiaOnly` sources unless ENABLE_INDIA_SOURCES is on (both off by default).
 */

export type SourceKind = "ats" | "api" | "jobspy" | "scraper";

export type SourcePolicy = Readonly<{
	id: string;
	label: string;
	kind: SourceKind;
	legalBasis: string;
	homeUrl: string;
	tosRestricted: boolean;
	indiaOnly: boolean;
	/** Aggregator display rule: show "via <label>" with a followed link back. */
	attributionRequired: boolean;
}>;

const EMPLOYER = "Public employer ATS feed (employer-published postings; link to the employer's apply URL)";

type Row = [id: string, label: string, kind: SourceKind, legalBasis: string, homeUrl: string, flags?: string];

const ROWS: readonly Row[] = [
	["greenhouse", "Greenhouse", "ats", EMPLOYER, "https://www.greenhouse.com"],
	["ashby", "Ashby", "ats", EMPLOYER, "https://www.ashbyhq.com"],
	["lever", "Lever", "ats", EMPLOYER, "https://www.lever.co"],
	["smartrecruiters", "SmartRecruiters", "ats", EMPLOYER, "https://www.smartrecruiters.com"],
	["workable", "Workable", "ats", EMPLOYER, "https://www.workable.com"],
	["recruitee", "Recruitee", "ats", EMPLOYER, "https://recruitee.com"],
	["personio", "Personio", "ats", EMPLOYER, "https://www.personio.com"],
	["teamtailor", "Teamtailor", "ats", EMPLOYER, "https://www.teamtailor.com"],
	[
		"usajobs",
		"USAJOBS",
		"api",
		"OPM USAJOBS API terms: free key, commercial and noncommercial reuse of public data allowed",
		"https://www.usajobs.gov",
	],
	[
		"himalayas",
		"Himalayas",
		"api",
		"Himalayas API terms: attribution and Himalayas apply URL required; no redistribution to job boards",
		"https://himalayas.app",
		"attribution",
	],
	[
		"jobicy",
		"Jobicy",
		"api",
		"Jobicy public feed terms: credit Jobicy with a direct link to the source listing",
		"https://jobicy.com",
		"attribution",
	],
	[
		"remoteok",
		"Remote OK",
		"api",
		"Remote OK API terms: mention Remote OK as the source with a followed link back; no logo",
		"https://remoteok.com",
		"attribution",
	],
	[
		"remotive",
		"Remotive",
		"api",
		"Remotive public API: 24-hour delay, link back and attribution required; redistribution limited",
		"https://remotive.com",
		"attribution",
	],
	[
		"arbeitnow",
		"Arbeitnow",
		"api",
		"Arbeitnow free API with backlink; commercial use unconfirmed (experimental)",
		"https://www.arbeitnow.com",
		"attribution",
	],
	[
		"adzuna",
		"Adzuna",
		"api",
		"Adzuna developer terms: keyed, capped quota; commercial use may need a license",
		"https://www.adzuna.com",
		"attribution",
	],
	["jooble", "Jooble", "api", "Jooble REST API key: 500 lifetime requests (benchmark only)", "https://jooble.org", "attribution"],
	["reed", "Reed", "api", "Reed jobseeker API key (UK); terms not yet reviewed", "https://www.reed.co.uk"],
	["bundesagentur", "Bundesagentur für Arbeit", "api", "Community-documented public endpoint (experimental)", "https://www.arbeitsagentur.de"],
	["mycareersfuture", "MyCareersFuture", "api", "Singapore government public job search API", "https://www.mycareersfuture.gov.sg"],
	["linkedin", "LinkedIn", "jobspy", "Restricted: LinkedIn terms prohibit unapproved scraping", "https://www.linkedin.com", "tos"],
	["glassdoor", "Glassdoor", "jobspy", "Restricted: Glassdoor terms prohibit automated scraping", "https://www.glassdoor.com", "tos"],
	["indeed", "Indeed", "jobspy", "Restricted: Indeed terms prohibit unapproved scraping", "https://www.indeed.com", "tos"],
	["naukri", "Naukri", "jobspy", "India-only board via JobSpy (opt-in)", "https://www.naukri.com", "india"],
	["google", "Google Jobs", "jobspy", "Search-result discovery via JobSpy (experimental)", "https://www.google.com"],
	["zip_recruiter", "ZipRecruiter", "jobspy", "Board via JobSpy (experimental, terms not reviewed)", "https://www.ziprecruiter.com"],
	["bayt", "Bayt", "jobspy", "Board via JobSpy (experimental, terms not reviewed)", "https://www.bayt.com"],
	["bdjobs", "BDJobs", "jobspy", "Board via JobSpy (experimental, terms not reviewed)", "https://www.bdjobs.com"],
	["wellfound", "Wellfound", "scraper", "Personal-scale scraper, robots.txt respected (opt-in)", "https://wellfound.com"],
	["instahyre", "Instahyre", "scraper", "India-only personal-scale scraper (opt-in)", "https://www.instahyre.com", "india"],
	["cutshort", "Cutshort", "scraper", "India-only personal-scale scraper (opt-in)", "https://cutshort.io", "india"],
	["seek", "SEEK", "scraper", "Blocked: requires a browser", "https://www.seek.com.au"],
];

export const SOURCE_REGISTRY: readonly SourcePolicy[] = ROWS.map(([id, label, kind, legalBasis, homeUrl, flags]) => ({
	id,
	label,
	kind,
	legalBasis,
	homeUrl,
	tosRestricted: flags === "tos",
	indiaOnly: flags === "india",
	attributionRequired: flags === "attribution",
}));

export function sourcePolicy(id: string): SourcePolicy | undefined {
	return SOURCE_REGISTRY.find((s) => s.id === id);
}

/** True when the worker runs the source with the production gates at their defaults. */
export function sourceEnabledByDefault(id: string): boolean {
	const policy = sourcePolicy(id);
	return !policy || (!policy.tosRestricted && !policy.indiaOnly);
}

// Posting URLs come from third-party feeds: only http(s) links are rendered.
function isHttpUrl(value: string | null | undefined): value is string {
	if (!value) return false;
	try {
		const { protocol } = new URL(value);
		return protocol === "https:" || protocol === "http:";
	} catch {
		return false;
	}
}

export type SourceAttribution = Readonly<{ label: string; href: string }>;

/** "via <source>" credit link for aggregator postings whose terms require it; null otherwise. */
export function sourceAttribution(source: string, url: string | null | undefined): SourceAttribution | null {
	const policy = sourcePolicy(source);
	if (!policy?.attributionRequired) return null;
	return { label: policy.label, href: isHttpUrl(url) ? url : policy.homeUrl };
}

/** Display name of a source id (falls back to the id). */
export function sourceLabel(source: string): string {
	return sourcePolicy(source)?.label ?? source;
}
