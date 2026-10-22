import { createServiceSupabase } from "@/lib/supabaseServer";
import { TASK_STATUSES, TASK_TYPES, type TaskRow } from "@/lib/tasks";
import Link from "next/link";
import { TasksTable } from "./TasksTable";
import { PageHeader } from "@/components/app/page-header";

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

	// Failed tasks per type (dead letters), for the summary row
	const failedByType: Record<string, number> = {};
	await Promise.all(
		TASK_TYPES.map(async (t) => {
			const { count: c } = await supabase
				.from("tasks")
				.select("id", { count: "exact", head: true })
				.eq("status", "failed")
				.eq("type", t);
			if (c) failedByType[t] = c;
		})
	);

	if (error) {
		console.error("Error fetching tasks:", error);
		return { tasks: [] as TaskRow[], total: 0, page, counts, failedByType, error: error.message };
	}

	return {
		tasks: (data || []) as TaskRow[],
		total: count || 0,
		page,
		counts,
		failedByType,
		error: null as string | null,
	};
}

export default async function TasksPage({
	searchParams,
}: {
	searchParams: { page?: string; status?: string; type?: string };
}) {
	const { tasks, total, page, counts, failedByType, error } = await getTasks(searchParams);
	const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

	return (
		<div className="space-y-6">
			<PageHeader title="Background tasks" description="Queue processed by the worker: PDF renders, job fetches, ranking and digests." className="mb-0" />

			{error && (
				<div className="rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
					Could not load tasks: {error}. Has the tasks migration been applied?
				</div>
			)}

			{Object.keys(failedByType).length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
					<span className="font-medium">Failed by type:</span>
					{Object.entries(failedByType)
						.sort((a, b) => b[1] - a[1])
						.map(([type, n]) => (
							<Link
								key={type}
								href={`/admin/tasks?status=failed&type=${type}`}
								className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive hover:bg-destructive/20"
							>
								{type}: {n}
							</Link>
						))}
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
