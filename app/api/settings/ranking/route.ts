import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";
import { parseJson } from "@/lib/api";
import { rankingSettingsUpdateSchema } from "@/lib/schemas/api";

export const runtime = "nodejs";
// Reads the session from req.cookies, which does not opt out of Next's fetch cache:
// without this, Supabase reads and upserts were served from .next/cache (stale data, lost saves).
export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";

/**
 * Ranking + morning digest settings (table ranking_settings, migration 021).
 * GET  /api/settings/ranking -> current settings (defaults when no row yet) + today's usage
 * PUT  /api/settings/ranking -> partial update; validated, upserted for the logged-in user only
 */

export interface RankingSettings {
	minSalary: number;
	minSalaryCurrency: string;
	homeCountry: string;
	knownLanguages: string[];
	needsVisaSponsorshipAbroad: boolean;
	excludedLocations: string[];
	excludedCompanies: string[];
	dailyLlmLimit: number;
	digestEnabled: boolean;
	digestHour: number;
	timezone: string;
}

// US-first defaults for people who haven't saved ranking settings yet (the column
// defaults in 20261024000550_us_ranking_defaults.sql match). Saved values always win.
// No salary floor by default: we don't guess one for someone.
const DEFAULTS: RankingSettings = {
	minSalary: 0,
	minSalaryCurrency: "USD",
	homeCountry: "United States",
	knownLanguages: ["English"],
	needsVisaSponsorshipAbroad: true,
	excludedLocations: [],
	excludedCompanies: [],
	dailyLlmLimit: 15,
	digestEnabled: true,
	digestHour: 8,
	timezone: "America/New_York",
};

const COLUMNS: Record<keyof RankingSettings, string> = {
	minSalary: "min_salary",
	minSalaryCurrency: "min_salary_currency",
	homeCountry: "home_country",
	knownLanguages: "known_languages",
	needsVisaSponsorshipAbroad: "needs_visa_sponsorship_abroad",
	excludedLocations: "excluded_locations",
	excludedCompanies: "excluded_companies",
	dailyLlmLimit: "daily_llm_limit",
	digestEnabled: "digest_enabled",
	digestHour: "digest_hour",
	timezone: "timezone",
};

function supabaseFor(req: NextRequest) {
	return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
		cookies: {
			get(name: string) {
				return req.cookies.get(name)?.value;
			},
			set() {},
			remove() {},
		},
	});
}

function fromRow(row: Record<string, unknown> | null): RankingSettings {
	if (!row) return { ...DEFAULTS };
	const out = { ...DEFAULTS } as Record<string, unknown>;
	for (const [key, col] of Object.entries(COLUMNS)) {
		if (row[col] !== null && row[col] !== undefined) out[key] = row[col];
	}
	out.minSalary = Number(out.minSalary);
	return out as unknown as RankingSettings;
}

function cleanList(v: unknown, field: string, max = 50): string[] {
	if (!Array.isArray(v)) throw new Error(`${field} must be a list of strings`);
	const items = v
		.map((x) => (typeof x === "string" ? x.trim() : ""))
		.filter((x) => x.length > 0)
		.map((x) => x.slice(0, 80));
	if (items.length > max) throw new Error(`${field} can have at most ${max} entries`);
	return Array.from(new Set(items));
}

function isValidTimezone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

/** Validate a partial update; returns DB column -> value. Throws Error with a user message. */
function validate(body: Record<string, unknown>): Record<string, unknown> {
	const update: Record<string, unknown> = {};
	for (const key of Object.keys(body)) {
		if (!(key in COLUMNS)) throw new Error(`Unknown field: ${key}`);
	}
	const b = body as Partial<Record<keyof RankingSettings, unknown>>;

	if (b.minSalary !== undefined) {
		const n = Number(b.minSalary);
		if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new Error("minSalary must be a positive number");
		update.min_salary = Math.round(n);
	}
	if (b.minSalaryCurrency !== undefined) {
		if (typeof b.minSalaryCurrency !== "string" || !/^[A-Za-z]{3}$/.test(b.minSalaryCurrency))
			throw new Error("minSalaryCurrency must be a 3-letter currency code");
		update.min_salary_currency = b.minSalaryCurrency.toUpperCase();
	}
	if (b.homeCountry !== undefined) {
		if (typeof b.homeCountry !== "string" || !b.homeCountry.trim() || b.homeCountry.length > 60)
			throw new Error("homeCountry is required");
		update.home_country = b.homeCountry.trim();
	}
	if (b.knownLanguages !== undefined) {
		const langs = cleanList(b.knownLanguages, "knownLanguages", 20);
		if (langs.length === 0) throw new Error("Add at least one language you speak");
		update.known_languages = langs;
	}
	if (b.needsVisaSponsorshipAbroad !== undefined) {
		if (typeof b.needsVisaSponsorshipAbroad !== "boolean") throw new Error("needsVisaSponsorshipAbroad must be true or false");
		update.needs_visa_sponsorship_abroad = b.needsVisaSponsorshipAbroad;
	}
	if (b.excludedLocations !== undefined) update.excluded_locations = cleanList(b.excludedLocations, "excludedLocations");
	if (b.excludedCompanies !== undefined) update.excluded_companies = cleanList(b.excludedCompanies, "excludedCompanies", 200);
	if (b.dailyLlmLimit !== undefined) {
		const n = Number(b.dailyLlmLimit);
		if (!Number.isInteger(n) || n < 0 || n > 200) throw new Error("dailyLlmLimit must be a whole number from 0 to 200");
		update.daily_llm_limit = n;
	}
	if (b.digestEnabled !== undefined) {
		if (typeof b.digestEnabled !== "boolean") throw new Error("digestEnabled must be true or false");
		update.digest_enabled = b.digestEnabled;
	}
	if (b.digestHour !== undefined) {
		const n = Number(b.digestHour);
		if (!Number.isInteger(n) || n < 0 || n > 23) throw new Error("digestHour must be from 0 to 23");
		update.digest_hour = n;
	}
	if (b.timezone !== undefined) {
		if (typeof b.timezone !== "string" || !isValidTimezone(b.timezone)) throw new Error("Unknown time zone");
		update.timezone = b.timezone;
	}
	return update;
}

async function usageToday(supabase: ReturnType<typeof supabaseFor>, userId: string) {
	const { data } = await supabase
		.from("ranking_usage")
		.select("day, llm_calls, embedding_calls")
		.eq("user_id", userId)
		.order("day", { ascending: false })
		.limit(1)
		.maybeSingle();
	return data ? { day: data.day, llmCalls: data.llm_calls, embeddingCalls: data.embedding_calls } : null;
}

export async function GET(req: NextRequest) {
	const supabase = supabaseFor(req);
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const { data, error } = await supabase
		.from("ranking_settings")
		.select("min_salary,min_salary_currency,home_country,known_languages,needs_visa_sponsorship_abroad,excluded_locations,excluded_companies,daily_llm_limit,digest_enabled,digest_hour,timezone,last_digest_at")
		.eq("user_id", user.id)
		.maybeSingle();
	if (error) {
		console.error("ranking settings fetch error:", error);
		return NextResponse.json({ error: "Failed to load ranking settings" }, { status: 500 });
	}

	return NextResponse.json({
		settings: fromRow(data),
		lastDigestAt: data?.last_digest_at ?? null,
		usage: await usageToday(supabase, user.id),
	});
}

export async function PUT(req: NextRequest) {
	const supabase = supabaseFor(req);
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const parsed = await parseJson(req, rankingSettingsUpdateSchema);
	if (!parsed.success) return parsed.response;
	const body = parsed.data;

	let update: Record<string, unknown>;
	try {
		update = validate(body);
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 400 });
	}

	// user_id always comes from the session; RLS also enforces owner-only writes.
	const { data, error } = await supabase
		.from("ranking_settings")
		.upsert({ ...update, user_id: user.id }, { onConflict: "user_id" })
		.select("min_salary,min_salary_currency,home_country,known_languages,needs_visa_sponsorship_abroad,excluded_locations,excluded_companies,daily_llm_limit,digest_enabled,digest_hour,timezone,last_digest_at")
		.single();
	if (error) {
		console.error("ranking settings save error:", error);
		return NextResponse.json({ error: "Failed to save ranking settings" }, { status: 500 });
	}

	return NextResponse.json({ success: true, settings: fromRow(data), lastDigestAt: data.last_digest_at ?? null });
}
