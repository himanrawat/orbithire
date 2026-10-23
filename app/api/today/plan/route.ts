import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { localDateKey, toggleItem } from "@/lib/today/nextStep";
import { planPatchSchema, type PlanPatch } from "@/lib/today/schema";
import {
	loadPlan,
	loadProfileBasics,
	loadSignals,
	regeneratePlan,
	type StoredPlan,
} from "@/lib/today/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchResult = { plan: StoredPlan } | { error: string; status: number };

async function todayKey(supabase: SupabaseClient, userId: string): Promise<string> {
	const { timeZone } = await loadProfileBasics(supabase, userId);
	return localDateKey(new Date(), timeZone);
}

function buildUpdate(plan: StoredPlan, patch: PlanPatch): Record<string, unknown> | null {
	if (patch.action === "dismiss_next_step") {
		return { next_step_dismissed_at: new Date().toISOString() };
	}
	const items = toggleItem(plan.items, patch.itemId, patch.done);
	return items ? { items } : null;
}

async function applyPatch(
	supabase: SupabaseClient,
	userId: string,
	patch: PlanPatch
): Promise<PatchResult> {
	const date = await todayKey(supabase, userId);
	const plan = await loadPlan(supabase, userId, date);
	if (!plan) return { error: "No plan for today", status: 404 };
	const update = buildUpdate(plan, patch);
	if (!update) return { error: "That item is not in today's plan", status: 404 };
	const { error } = await supabase
		.from("daily_plans")
		.update(update)
		.eq("user_id", userId)
		.eq("date", date);
	if (error) {
		console.error("[today] plan update failed:", error);
		return { error: "Could not update your plan", status: 500 };
	}
	const updated = await loadPlan(supabase, userId, date);
	return updated ? { plan: updated } : { error: "No plan for today", status: 404 };
}

/** PATCH /api/today/plan – check off an item, or dismiss the next step for today. */
export async function PATCH(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await parseJson(req, planPatchSchema);
	if (!body.success) return body.response;
	const result = await applyPatch(auth.supabase, auth.user.id, body.data).catch((error: unknown) => {
		console.error("[today] plan patch failed:", error);
		return { error: "Could not update your plan", status: 500 } as const;
	});
	if ("error" in result) {
		return NextResponse.json({ error: result.error }, { status: result.status });
	}
	return NextResponse.json({ plan: result.plan });
}

/** POST /api/today/plan – regenerate today's plan with the rules (keeps check-offs). */
export async function POST() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { supabase, user } = auth;
	try {
		const { timeZone } = await loadProfileBasics(supabase, user.id);
		const signals = await loadSignals(supabase, user.id, new Date(), timeZone);
		const plan = await regeneratePlan(supabase, user.id, signals);
		if (plan) return NextResponse.json({ plan });
	} catch (error) {
		console.error("[today] regenerate failed:", error);
	}
	return NextResponse.json({ error: "Could not regenerate your plan" }, { status: 500 });
}
