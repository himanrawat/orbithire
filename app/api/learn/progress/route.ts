import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJson } from "@/lib/api";
import { requireUser, serverError } from "@/lib/jobs/server";
import { buildProgressRow } from "@/lib/learn/entries";
import { progressSchema, type ProgressInput } from "@/lib/learn/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function lessonExists(supabase: SupabaseClient, lessonId: string) {
	const { data } = await supabase.from("path_lessons").select("id").eq("id", lessonId).maybeSingle();
	return Boolean(data);
}

async function currentStatus(supabase: SupabaseClient, userId: string, lessonId: string) {
	const { data } = await supabase
		.from("path_progress")
		.select("status")
		.eq("user_id", userId)
		.eq("lesson_id", lessonId)
		.maybeSingle();
	return (data?.status as string | undefined) ?? null;
}

/** Opening a finished lesson again must not undo "done"; marking done or reopening explicitly does. */
async function saveProgress(supabase: SupabaseClient, userId: string, input: ProgressInput) {
	if (input.status === "in_progress" && (await currentStatus(supabase, userId, input.lessonId)) !== null) {
		return null;
	}
	const { error } = await supabase
		.from("path_progress")
		.upsert(buildProgressRow(userId, input.lessonId, input.status, new Date()), { onConflict: "user_id,lesson_id" });
	return error;
}

/**
 * POST /api/learn/progress { lessonId, status } – "in_progress" when a lesson is opened
 * (no-op if already tracked), "done" when the person marks it done.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, progressSchema);
	if (!parsed.success) return parsed.response;
	if (!(await lessonExists(auth.supabase, parsed.data.lessonId))) {
		return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
	}
	const error = await saveProgress(auth.supabase, auth.user.id, parsed.data);
	if (error) return serverError("Could not save your progress", error);
	return NextResponse.json({ ok: true, status: parsed.data.status });
}
