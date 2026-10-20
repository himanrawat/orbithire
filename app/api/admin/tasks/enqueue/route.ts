import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { enqueueTask } from "@/lib/tasks";

async function verifyAdmin() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token");

	if (!adminToken) {
		return null;
	}

	const supabase = createServiceSupabase();
	const { data: admin } = await supabase
		.from("admin_users")
		.select("id, email, name")
		.eq("id", adminToken.value)
		.eq("is_active", true)
		.single();

	return admin;
}

/**
 * Enqueue a test task from the admin panel (Phase 0 acceptance check).
 * Only `noop` is allowed here; real tasks are enqueued by the features that need them.
 */
export async function POST(req: NextRequest) {
	try {
		const admin = await verifyAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		if ((body.type ?? "noop") !== "noop") {
			return NextResponse.json({ error: "Only noop tasks can be enqueued here" }, { status: 400 });
		}
		const fail = Boolean(body.payload?.fail);

		const id = await enqueueTask("noop", { fail, source: "admin" });

		const supabase = createServiceSupabase();
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "enqueue_task",
			target_type: "task",
			target_id: id,
			details: { type: "noop", fail },
		});

		return NextResponse.json({ success: true, id });
	} catch (error) {
		console.error("Task enqueue API error:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Something went wrong" },
			{ status: 500 }
		);
	}
}
