/** Server-only helpers for the /api/jobs routes. */
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
	API_SOURCE_IDS,
	ATS_TYPES,
	JOB_SITES,
	MAX_JOB_SEARCHES,
	countryByCode,
	defaultSitesFor,
	defaultSourcesFor,
	type ApiSource,
	type AtsType,
	type JobSite,
} from "./types";

export type Authed =
	| { supabase: SupabaseClient; user: User; error?: undefined }
	| { error: NextResponse; supabase?: undefined; user?: undefined };

/** User-scoped (RLS) client + the logged-in user, or a 401 response. */
export async function requireUser(): Promise<Authed> {
	const supabase = createServerSupabase() as unknown as SupabaseClient;
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error || !user) {
		return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
	}
	return { supabase, user };
}

export function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 });
}

export const SEARCH_LIMIT_MESSAGE = `You can have at most ${MAX_JOB_SEARCHES} job searches. Delete or edit an existing one.`;

/** 409 for the "max job searches" limit (API pre-check or the DB trigger). */
export function searchLimitReached() {
	return NextResponse.json({ error: SEARCH_LIMIT_MESSAGE, code: "search_limit" }, { status: 409 });
}

/** True for the enforce_job_search_limit() trigger error (migration 025). */
export function isSearchLimitError(err: { message?: string; code?: string } | null | undefined): boolean {
	return !!err && (err.message || "").includes("job_search_limit");
}

export function serverError(message: string, err?: unknown) {
	if (err) console.error(`[jobs] ${message}:`, err);
	return NextResponse.json({ error: message }, { status: 500 });
}

/** Accepts an array or a comma/newline separated string; trims, drops empties, dedupes. */
export function toStringList(v: unknown, max = 100): string[] {
	const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\n,]/) : [];
	const out: string[] = [];
	for (const item of raw) {
		const s = String(item ?? "").trim();
		if (s && !out.includes(s)) out.push(s.slice(0, 200));
		if (out.length >= max) break;
	}
	return out;
}

/** Validates the editable job_searches fields present in `body`. */
export function parseSearchInput(
	body: Record<string, unknown>,
	partial: boolean
): { data: Record<string, unknown>; error?: string } {
	const data: Record<string, unknown> = {};
	const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
	if (has("name") || !partial) {
		const name = String(body.name ?? "Default").trim().slice(0, 100);
		data.name = name || "Default";
	}
	for (const k of ["keywords", "include_keywords", "exclude_keywords", "locations"]) {
		if (has(k)) data[k] = toStringList(body[k]);
	}
	if (!partial && !(data.keywords as string[] | undefined)?.length) {
		return { data, error: "At least one search keyword is required" };
	}
	if (has("country") || !partial) {
		const c = countryByCode(String(body.country ?? (partial ? "" : "IN")));
		if (!c) return { data, error: "Unsupported country" };
		data.country = c.code;
	}
	if (has("sites")) {
		data.sites = toStringList(body.sites).filter((s): s is JobSite =>
			(JOB_SITES as readonly string[]).includes(s)
		);
	} else if (!partial) {
		data.sites = defaultSitesFor(data.country as string);
	}
	if (has("sources")) {
		data.sources = toStringList(body.sources).filter((s): s is ApiSource =>
			(API_SOURCE_IDS as readonly string[]).includes(s)
		);
	} else if (!partial) {
		data.sources = defaultSourcesFor(data.country as string);
	}
	if (
		("sites" in data || "sources" in data) &&
		!partial &&
		!(data.sites as string[]).length &&
		!(data.sources as string[]).length
	) {
		return { data, error: "Pick at least one job board or source" };
	}
	if (has("remote_ok")) data.remote_ok = Boolean(body.remote_ok);
	if (has("enabled")) data.enabled = Boolean(body.enabled);
	if (has("hours_old")) {
		const n = Number(body.hours_old);
		if (!Number.isInteger(n) || n < 1 || n > 24 * 30) return { data, error: "hours_old must be 1–720" };
		data.hours_old = n;
	}
	if (has("results_wanted")) {
		const n = Number(body.results_wanted);
		if (!Number.isInteger(n) || n < 1 || n > 500) return { data, error: "results_wanted must be 1–500" };
		data.results_wanted = n;
	}
	return { data };
}

export function parseWatchedInput(
	body: Record<string, unknown>,
	partial: boolean
): { data: Record<string, unknown>; error?: string } {
	const data: Record<string, unknown> = {};
	const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
	if (has("company") || !partial) {
		const company = String(body.company ?? "").trim().slice(0, 200);
		if (!company) return { data, error: "Company name is required" };
		data.company = company;
	}
	if (has("ats") || !partial) {
		const ats = String(body.ats ?? "");
		if (!(ATS_TYPES as readonly string[]).includes(ats)) {
			return { data, error: `ATS must be one of: ${ATS_TYPES.join(", ")}` };
		}
		data.ats = ats as AtsType;
	}
	if (has("board_token") || !partial) {
		const token = String(body.board_token ?? "").trim();
		if (!/^[A-Za-z0-9._-]{1,120}$/.test(token)) {
			return { data, error: "Board token must be letters, digits, '.', '_' or '-'" };
		}
		data.board_token = token;
	}
	if (has("careers_url")) {
		const url = String(body.careers_url ?? "").trim();
		if (url && !/^https?:\/\//i.test(url)) return { data, error: "Careers URL must start with http(s)://" };
		data.careers_url = url || null;
	}
	if (has("enabled")) data.enabled = Boolean(body.enabled);
	return { data };
}
