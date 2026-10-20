/**
 * career-ops `portals.yml` parser – a TypeScript port of
 * worker/orbithire_worker/fetchers/portals.py (detect_ats + parse_portals).
 * Keep the two in sync.
 */
import { load as loadYaml } from "js-yaml";
import type { AtsType } from "./types";

export interface PortalCompany {
	company: string;
	ats: AtsType | null;
	board_token: string | null;
	careers_url: string | null;
	enabled: boolean;
	region: "us" | "eu";
}

export interface PortalsConfig {
	companies: PortalCompany[];
	positive: string[];
	negative: string[];
	seniority_boost: string[];
}

const ATS_PATTERNS: [AtsType, RegExp][] = [
	["greenhouse", /^boards-api(\.eu)?\.greenhouse\.io$/],
	["greenhouse", /^(job-)?boards(\.eu)?\.greenhouse\.io$/],
	["lever", /^(jobs|api)(\.eu)?\.lever\.co$/],
	["ashby", /^(jobs|api)\.ashbyhq\.com$/],
	["workable", /^(apply\.)?workable\.com$|^[a-z0-9-]+\.workable\.com$/],
	["smartrecruiters", /^(jobs|careers|api)\.smartrecruiters\.com$/],
	["recruitee", /^[a-z0-9-]+\.recruitee\.com$/],
	["personio", /^[a-z0-9-]+\.jobs\.personio\.(de|com)$/],
	["teamtailor", /^[a-z0-9-]+\.(na\.)?teamtailor\.com$/],
];

const SUBDOMAIN_RESERVED = new Set(["www", "app", "api", "apply", "jobs", "careers", "help", "support", "na"]);

/**
 * (ats, board token, region) from a careers / API URL.
 * region: Greenhouse/Lever "eu" hosts; Personio "eu" = .de, "us" = .com;
 * Teamtailor "us" = <slug>.na.teamtailor.com.
 */
export function detectAts(url: string | null | undefined): {
	ats: AtsType | null;
	token: string | null;
	region: "us" | "eu";
} {
	if (!url) return { ats: null, token: null, region: "us" };
	let parsed: URL;
	try {
		const raw = String(url).trim();
		parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
	} catch {
		return { ats: null, token: null, region: "us" };
	}
	let host = parsed.hostname.toLowerCase();
	if (host.startsWith("www.")) host = host.slice(4);
	const segments = parsed.pathname.split("/").filter(Boolean);
	let region: "us" | "eu" = `.${host}`.includes(".eu.") ? "eu" : "us";
	const after = (key: string) => {
		const i = segments.indexOf(key);
		return i >= 0 && i + 1 < segments.length ? segments[i + 1] : null;
	};
	const sub = host.split(".")[0];
	const subToken = SUBDOMAIN_RESERVED.has(sub) ? null : sub;
	for (const [ats, pattern] of ATS_PATTERNS) {
		if (!pattern.test(host)) continue;
		let token: string | null = null;
		switch (ats) {
			case "greenhouse":
				if (host.startsWith("boards-api")) token = after("boards");
				else if (segments.length)
					token = segments[0] === "embed" ? parsed.searchParams.get("for") : segments[0];
				break;
			case "lever":
				token = host.startsWith("api.") ? after("postings") : segments[0] || null;
				break;
			case "ashby":
				token = host.startsWith("api.") ? after("job-board") : segments[0] || null;
				break;
			case "workable":
				if (host === "apply.workable.com" || host === "workable.com") {
					if (segments[0] === "api") token = after("accounts");
					else token = segments[0] && segments[0] !== "j" ? segments[0] : null;
				} else token = subToken;
				break;
			case "smartrecruiters":
				token = host.startsWith("api.") ? after("companies") : segments[0] || null;
				break;
			case "personio":
				region = host.endsWith(".de") ? "eu" : "us";
				token = subToken;
				break;
			case "teamtailor":
				region = host.includes(".na.teamtailor.com") ? "us" : "eu";
				token = subToken;
				break;
			case "recruitee":
				token = subToken;
				break;
		}
		if (token) return { ats, token, region };
	}
	return { ats: null, token: null, region };
}

function strList(v: unknown): string[] {
	if (!Array.isArray(v)) return [];
	return v
		.filter((x) => x !== null && x !== undefined)
		.map((x) => String(x).trim())
		.filter(Boolean);
}

export function parsePortals(data: unknown): PortalsConfig {
	const root = (data && typeof data === "object" ? data : {}) as Record<string, any>;
	const tf = (root.title_filter || {}) as Record<string, unknown>;
	const cfg: PortalsConfig = {
		companies: [],
		positive: strList(tf.positive),
		negative: strList(tf.negative),
		seniority_boost: strList(tf.seniority_boost),
	};
	const seen = new Set<string>();
	for (const entry of Array.isArray(root.tracked_companies) ? root.tracked_companies : []) {
		if (!entry || typeof entry !== "object" || !entry.name) continue;
		const name = String(entry.name).trim();
		if (seen.has(name.toLowerCase())) continue;
		seen.add(name.toLowerCase());
		const careersUrl = entry.careers_url ? String(entry.careers_url) : null;
		let { ats, token, region } = detectAts(entry.api);
		const c = detectAts(careersUrl);
		if (!ats) {
			ats = c.ats;
			token = c.token;
		}
		if (c.region === "eu" && c.ats === ats) region = "eu";
		cfg.companies.push({
			company: name,
			ats,
			board_token: token,
			careers_url: careersUrl,
			enabled: entry.enabled !== false,
			region,
		});
	}
	return cfg;
}

export function parsePortalsYaml(text: string): PortalsConfig {
	const data = loadYaml(text, { json: true });
	return parsePortals(data);
}

export const IMPORTED_SEARCH_NAME = "Default (imported from portals.yml)";
