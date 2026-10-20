import { NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/jobs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TASK_FIELDS = "id, type, status, attempts, max_attempts, last_error, result, payload, created_at, updated_at";

// GET /api/jobs/fetch – status of the user's latest fetch batch + rank task.
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { supabase, user } = auth;

	const { data: tasks, error } = await supabase
		.from("tasks")
		.select(TASK_FIELDS)
		.eq("user_id", user.id)
		.in("type", ["fetch_jobs", "rank_jobs"])
		.order("created_at", { ascending: false })
		.limit(10);
	if (error) return serverError("Failed to load fetch status", error);

	const fetchTasks = (tasks || []).filter((t) => t.type === "fetch_jobs");
	// The latest batch: fetch tasks created within 2 minutes of the newest one.
	const newest = fetchTasks[0] ? new Date(fetchTasks[0].created_at).getTime() : 0;
	const batch = fetchTasks.filter((t) => newest - new Date(t.created_at).getTime() < 120_000);
	const rank = (tasks || []).find((t) => t.type === "rank_jobs") || null;
	const active = batch.some((t) => t.status === "queued" || t.status === "running");

	return NextResponse.json({ batch, rank, active });
}

// POST /api/jobs/fetch – "Fetch now" (rpc request_job_fetch, rate-limited in the DB).
export async function POST() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { data, error } = await auth.supabase.rpc("request_job_fetch");
	if (error) return serverError("Failed to start fetch", error);
	const res = data as {
		queued: boolean;
		reason?: string;
		retry_at?: string;
		task_ids?: string[];
	};
	if (!res.queued) {
		const messages: Record<string, string> = {
			in_progress: "A fetch is already running.",
			too_soon: "You fetched less than 10 minutes ago – try again shortly.",
			nothing_to_fetch: "Add a job search or watched company in Settings → Job search first.",
		};
		return NextResponse.json(
			{ ...res, message: messages[res.reason || ""] || "Fetch not started." },
			{ status: res.reason === "nothing_to_fetch" ? 400 : 429 }
		);
	}
	return NextResponse.json(res);
}
