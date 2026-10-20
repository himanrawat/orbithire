import { createServiceSupabase } from "@/lib/supabaseServer";
import { TASK_STATUSES, TASK_TYPES, type TaskRow } from "@/lib/tasks";
import { TasksTable } from "./TasksTable";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

async function getTasks(searchParams: { page?: string; status?: string; type?: string }) {
	const supabase = createServiceSupabase();
	const page = Math.max(parseInt(searchParams.page || "1") || 1, 1);
	const offset = (page - 1) * PAGE_SIZE;
	const status = searchParams.status || "all";
	const type = searchParams.type || "all";

	let query = supabase
		.from("tasks")
		.select(
			"id, type, payload, status, priority, attempts, max_attempts, run_after, locked_at, locked_by, last_error, result, user_id, created_at, updated_at",
			{ count: "exact" }
		)
		.order("created_at", { ascending: false })
		.range(offset, offset + PAGE_SIZE - 1);

	if (status !== "all" && (TASK_STATUSES as readonly string[]).includes(status)) {
		query = query.eq("status", status);
	}
	if (type !== "all" && (TASK_TYPES as readonly string[]).includes(type)) {
		query = query.eq("type", type);
	}

	const { data, count, error } = await query;

	// Counts per status for the summary badges
	const counts: Record<string, number> = {};
	await Promise.all(
		TASK_STATUSES.map(async (s) => {
			const { count: c } = await supabase
				.from("tasks")
				.select("id", { count: "exact", head: true })
				.eq("status", s);
			counts[s] = c || 0;
		})
	);

	if (error) {
		console.error("Error fetching tasks:", error);
		return { tasks: [] as TaskRow[], total: 0, page, counts, error: error.message };
	}

	return {
		tasks: (data || []) as TaskRow[],
		total: count || 0,
		page,
		counts,
		error: null as string | null,
	};
}

export default async function TasksPage({
	searchParams,
}: {
	searchParams: { page?: string; status?: string; type?: string };
}) {
	const { tasks, total, page, counts, error } = await getTasks(searchParams);
	const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Background Tasks</h1>
				<p className="text-muted-foreground">
					Queue processed by the worker: PDF renders, job fetches, ranking and digests.
				</p>
			</div>

			{error && (
				<div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
					Could not load tasks: {error}. Has the tasks migration been applied?
				</div>
			)}

			<TasksTable
				tasks={tasks}
				total={total}
				page={page}
				pageSize={PAGE_SIZE}
				totalPages={totalPages}
				counts={counts}
			/>
		</div>
	);
}
