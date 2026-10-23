import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJson } from "@/lib/api";
import { createServerSupabase } from "@/lib/supabaseServer";
import { COMPLETION_COOKIE } from "@/lib/onboarding/stages";
import {
	ONBOARDING_COLUMNS,
	buildOnboardingUpdate,
	onboardingSchema,
	toOnboardingProfile,
} from "@/lib/onboarding/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

async function requireUser() {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user ? { supabase, userId: user.id } : null;
}

async function loadOnboarding(supabase: SupabaseClient, userId: string) {
	const { data, error } = await supabase.from("profiles").select(ONBOARDING_COLUMNS).eq("id", userId).maybeSingle();
	if (error) throw new Error(error.message);
	return toOnboardingProfile(data as Record<string, unknown> | null);
}

function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function serverError(message: string) {
	return NextResponse.json({ error: message }, { status: 500 });
}

/** GET /api/onboarding → { onboarding: { career_stage, goals, ... } } */
export async function GET() {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	try {
		return NextResponse.json({ onboarding: await loadOnboarding(auth.supabase, auth.userId) });
	} catch {
		return serverError("Could not load your setup");
	}
}

/**
 * PATCH /api/onboarding – saves any of the onboarding fields. `complete: true` marks setup
 * finished (or skipped) so the app stops sending the person to /onboarding.
 */
export async function PATCH(req: NextRequest) {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	const parsed = await parseJson(req, onboardingSchema);
	if (!parsed.success) return parsed.response;

	const update = buildOnboardingUpdate(parsed.data, new Date());
	if (Object.keys(update).length === 0) {
		return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
	}
	update.updated_at = new Date().toISOString();

	const { error } = await auth.supabase.from("profiles").update(update).eq("id", auth.userId);
	if (error) return serverError("Could not save your setup");

	const response = NextResponse.json({ onboarding: await loadOnboarding(auth.supabase, auth.userId).catch(() => null) });
	if (parsed.data.complete) {
		response.cookies.set(COMPLETION_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: ONE_YEAR_SECONDS });
	}
	return response;
}
