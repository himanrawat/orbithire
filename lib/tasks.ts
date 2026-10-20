/**
 * Background task queue (Postgres `tasks` table, processed by worker/).
 *
 * Server-only. Tasks are enqueued through the SECURITY DEFINER rpc
 * `enqueue_task(p_type, p_payload, p_priority, p_user_id)`, which inserts the
 * row; an insert trigger fires `pg_notify('tasks_new', type)` so the worker
 * picks it up immediately.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "./supabaseServer";
import { isTaskType, type TaskRow, type TaskType } from "./taskTypes";

export { TASK_TYPES, TASK_STATUSES, isTaskType } from "./taskTypes";
export type { TaskType, TaskStatus, TaskRow } from "./taskTypes";

export interface EnqueueTaskOptions {
	/** Higher runs first. Default 0. */
	priority?: number;
	/** Owner of the task (for user-scoped tasks). */
	userId?: string | null;
	/**
	 * Client to call the rpc with. Defaults to the service-role client.
	 * Pass a user-scoped client if the rpc should run with the caller's JWT.
	 */
	client?: SupabaseClient;
}

/**
 * Enqueue a background task. Returns the new task id.
 *
 * @example
 *   await enqueueTask("render_pdf", { resumeId }, { userId: user.id, priority: 5 });
 */
export async function enqueueTask(
	type: TaskType,
	payload: Record<string, unknown> = {},
	opts: EnqueueTaskOptions = {}
): Promise<string> {
	if (!isTaskType(type)) {
		throw new Error(`Unknown task type: ${type}`);
	}
	const supabase = opts.client ?? createServiceSupabase();
	const { data, error } = await supabase.rpc("enqueue_task", {
		p_type: type,
		p_payload: payload,
		p_priority: opts.priority ?? 0,
		p_user_id: opts.userId ?? null,
	});
	if (error) {
		throw new Error(`enqueue_task(${type}) failed: ${error.message}`);
	}
	// enqueue_task returns the new task's uuid.
	const id = typeof data === "string" ? data : (data as { id?: string } | null)?.id;
	if (!id) {
		throw new Error(`enqueue_task(${type}) returned no id`);
	}
	return String(id);
}

/**
 * Put a task back in the queue (admin retry): status=queued, attempts=0,
 * runnable now. Uses the service role.
 */
export async function retryTask(taskId: string): Promise<TaskRow | null> {
	const supabase = createServiceSupabase();
	const { data, error } = await supabase
		.from("tasks")
		.update({
			status: "queued",
			attempts: 0,
			run_after: new Date().toISOString(),
			locked_at: null,
			locked_by: null,
			updated_at: new Date().toISOString(),
		})
		.eq("id", taskId)
		.neq("status", "running")
		.select()
		.maybeSingle();
	if (error) {
		throw new Error(`retryTask failed: ${error.message}`);
	}
	return data as TaskRow | null;
}
