import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { retryTask } from "@/lib/tasks";
import { requireAdmin } from "@/lib/adminAuth";
import { parseJson } from "@/lib/api";
import { retryTaskSchema } from "@/lib/schemas/admin";

export async function POST(req: NextRequest) {
	try {
		const admin = await requireAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(req, retryTaskSchema);
		if (!parsed.success) return parsed.response;
		const { taskId } = parsed.data;
		if (!taskId || typeof taskId !== "string") {
			return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
		}

		const task = await retryTask(taskId);
		if (!task) {
			return NextResponse.json(
				{ error: "Task not found or currently running" },
				{ status: 409 }
			);
		}

		const supabase = createServiceSupabase();
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "retry_task",
			target_type: "task",
			target_id: taskId,
			details: { type: task.type },
		});

		return NextResponse.json({ success: true, task });
	} catch (error) {
		console.error("Task retry API error:", error);
		return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
	}
}
