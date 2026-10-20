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
];

export function detectAts(url: string | null | undefined): {
	ats: AtsType | null;
	token: string | null;
	region: "us" | "eu";
} {
	if (!url) return { ats: null, token: null, region: "us" };
	let parsed: URL;
	try {
		parsed = new URL(String(url).trim());
	} catch {
		return { ats: null, token: null, region: "us" };
	}
	const host = parsed.hostname.toLowerCase();
	const segments = parsed.pathname.split("/").filter(Boolean);
	const region = `.${host}`.includes(".eu.") ? "eu" : "us";
	const after = (key: string) => {
		const i = segments.indexOf(key);
		return i >= 0 && i + 1 < segments.length ? segments[i + 1] : null;
	};
	for (const [ats, pattern] of ATS_PATTERNS) {
		if (!pattern.test(host)) continue;
		let token: string | null = null;
		if (host.startsWith("boards-api")) token = after("boards");
		else if (host.startsWith("api.") && ats === "lever") token = after("postings");
		else if (host.startsWith("api.") && ats === "ashby") token = after("job-board");
		else if (segments.length) {
			token = segments[0] === "embed" ? parsed.searchParams.get("for") : segments[0];
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
