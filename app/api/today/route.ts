import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/jobs/server";
import { localDateKey, pickNextStep } from "@/lib/today/nextStep";
import {
	ensurePlan,
	loadComingUp,
	loadProfileBasics,
	loadSignals,
	loadTopMatches,
	loadWeek,
	loadWeeklyFocus,
	type StoredPlan,
} from "@/lib/today/server";
import { loadCommunityPreview } from "@/lib/today/community";
import type { TodayData, TodayPlan } from "@/lib/today/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toPlan(stored: StoredPlan | null): TodayPlan | null {
	if (!stored) return null;
	return { date: stored.date, items: stored.items, generatedAt: stored.generatedAt };
}

async function buildTodayData(supabase: SupabaseClient, userId: string): Promise<TodayData> {
	const now = new Date();
	const profile = await loadProfileBasics(supabase, userId);
	const signals = await loadSignals(supabase, userId, now, profile.timeZone);
	const date = localDateKey(now, profile.timeZone);
	const [plan, matches, comingUp, weeklyFocus, community] = await Promise.all([
		ensurePlan(supabase, userId, signals),
		loadTopMatches(supabase, userId),
		loadComingUp(supabase, userId, now),
		loadWeeklyFocus(supabase, userId, now),
		loadCommunityPreview(supabase, userId),
	]);
	// After ensurePlan, so today's plan (and its check-offs) is counted.
	const week = await loadWeek(supabase, userId, date);
	return {
		firstName: profile.firstName,
		timeZone: profile.timeZone,
		date,
		nextStep: pickNextStep(signals),
		nextStepDismissed: plan?.nextStepDismissed ?? false,
		plan: toPlan(plan),
		matches,
		comingUp,
		weeklyFocus,
		week,
		community,
	};
}

/** GET /api/today – everything the Today page shows; creates today's plan if missing. */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		const data = await buildTodayData(auth.supabase, auth.user.id);
		return NextResponse.json(data);
	} catch (error) {
		console.error("[today] load failed:", error);
		return NextResponse.json({ error: "Could not load Today" }, { status: 500 });
	}
}
