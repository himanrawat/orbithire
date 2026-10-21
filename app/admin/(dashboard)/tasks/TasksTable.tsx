"use client";

import { LocalDate } from "@/components/LocalDate";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ChevronLeft,
	ChevronRight,
	Eye,
	Loader2,
	Plus,
	RefreshCw,
	RotateCcw,
} from "lucide-react";
import { TASK_STATUSES, TASK_TYPES, type TaskRow } from "@/lib/taskTypes";

interface TasksTableProps {
	tasks: TaskRow[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
	counts: Record<string, number>;
}

const statusColors = {
	queued: "secondary",
	running: "warning",
	done: "success",
	failed: "destructive",
} as const;

function formatDate(value: string | null) {
	return value ? new Date(value).toLocaleString() : "—";
}

function firstLine(text: string | null) {
	return text ? text.split("\n")[0] : "";
}

export function TasksTable({ tasks, total, page, pageSize, totalPages, counts }: TasksTableProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [busyId, setBusyId] = useState<string | null>(null);
	const [enqueueing, setEnqueueing] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [selected, setSelected] = useState<TaskRow | null>(null);

	const currentStatus = searchParams.get("status") || "all";
	const currentType = searchParams.get("type") || "all";

	const pushParams = (mutate: (p: URLSearchParams) => void) => {
		const params = new URLSearchParams(searchParams.toString());
		mutate(params);
		router.push(`/admin/tasks?${params.toString()}`);
	};

	const handleFilterChange = (key: "status" | "type", value: string) =>
		pushParams((p) => {
			if (value === "all") p.delete(key);
			else p.set(key, value);
			p.set("page", "1");
		});

	const handlePageChange = (newPage: number) =>
		pushParams((p) => p.set("page", newPage.toString()));

	const retry = async (taskId: string) => {
		setBusyId(taskId);
		setMessage(null);
		try {
			const res = await fetch("/api/admin/tasks/retry", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Failed to retry task");
			setSelected(null);
			router.refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Failed to retry task");
		} finally {
			setBusyId(null);
		}
	};

	const enqueueTest = async (fail: boolean) => {
		setEnqueueing(true);
		setMessage(null);
		try {
			const res = await fetch("/api/admin/tasks/enqueue", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type: "noop", payload: { fail } }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Failed to enqueue task");
			setMessage(`Enqueued ${fail ? "failing " : ""}noop task ${data.id}`);
			router.refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Failed to enqueue task");
		} finally {
			setEnqueueing(false);
		}
	};

	return (
		<>
			{/* Summary */}
			<div className="flex flex-wrap gap-2">
				{TASK_STATUSES.map((s) => (
					<Badge key={s} variant={statusColors[s]}>
						{s}: {counts[s] ?? 0}
					</Badge>
				))}
			</div>

			{/* Filters + actions */}
			<div className="flex flex-wrap gap-4 items-center">
				<Select value={currentStatus} onValueChange={(v) => handleFilterChange("status", v)}>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						{TASK_STATUSES.map((s) => (
							<SelectItem key={s} value={s}>
								{s}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={currentType} onValueChange={(v) => handleFilterChange("type", v)}>
					<SelectTrigger className="w-[160px]">
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All types</SelectItem>
						{TASK_TYPES.map((t) => (
							<SelectItem key={t} value={t}>
								{t}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="flex gap-2 ml-auto">
					<Button variant="outline" size="sm" onClick={() => router.refresh()}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
					<Button variant="outline" size="sm" disabled={enqueueing} onClick={() => enqueueTest(false)}>
						{enqueueing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
						Test task
					</Button>
					<Button variant="outline" size="sm" disabled={enqueueing} onClick={() => enqueueTest(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Failing test task
					</Button>
				</div>
			</div>

			{message && <p className="text-sm text-muted-foreground">{message}</p>}

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Type</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Attempts</TableHead>
							<TableHead>Last error</TableHead>
							<TableHead>Run after</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="w-[100px]">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{tasks.length === 0 ? (
							<TableRow>
								<TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
									No tasks found
								</TableCell>
							</TableRow>
						) : (
							tasks.map((task) => (
								<TableRow key={task.id}>
									<TableCell>
										<p className="font-medium">{task.type}</p>
										<p className="text-xs text-muted-foreground font-mono">{task.id.slice(0, 8)}</p>
									</TableCell>
									<TableCell>
										<Badge variant={statusColors[task.status] ?? "outline"}>{task.status}</Badge>
										{task.locked_by && task.status === "running" && (
											<p className="text-xs text-muted-foreground mt-1 truncate max-w-[140px]">
												{task.locked_by}
											</p>
										)}
									</TableCell>
									<TableCell>
										{task.attempts}/{task.max_attempts}
									</TableCell>
									<TableCell className="max-w-[320px] truncate text-sm text-muted-foreground" title={firstLine(task.last_error)}>
										{firstLine(task.last_error) || "—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{task.status === "queued" ? <LocalDate value={task.run_after} withTime /> : "—"}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										<LocalDate value={task.created_at} withTime />
									</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button variant="ghost" size="icon" onClick={() => setSelected(task)} title="Details">
												<Eye className="h-4 w-4" />
											</Button>
											{task.status !== "running" && task.status !== "queued" && (
												<Button
													variant="ghost"
													size="icon"
													title="Retry"
													disabled={busyId === task.id}
													onClick={() => retry(task.id)}
												>
													{busyId === task.id ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<RotateCcw className="h-4 w-4" />
													)}
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					{total === 0
						? "No tasks"
						: `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total} tasks`}
				</p>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handlePageChange(page + 1)}
						disabled={page >= totalPages}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Details */}
			<Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
				<DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{selected?.type} · {selected?.status}
						</DialogTitle>
						<DialogDescription className="font-mono text-xs">{selected?.id}</DialogDescription>
					</DialogHeader>
					{selected && (
						<div className="space-y-4 text-sm">
							<div className="grid grid-cols-2 gap-2">
								<p>Attempts: {selected.attempts}/{selected.max_attempts}</p>
								<p>Priority: {selected.priority}</p>
								<p>Created: {formatDate(selected.created_at)}</p>
								<p>Updated: {formatDate(selected.updated_at)}</p>
								<p>Run after: {formatDate(selected.run_after)}</p>
								<p>Locked by: {selected.locked_by || "—"}</p>
								<p className="col-span-2">User: {selected.user_id || "—"}</p>
							</div>
							<div>
								<p className="font-medium mb-1">Payload</p>
								<pre className="rounded-lg bg-muted p-3 overflow-x-auto text-xs">
									{JSON.stringify(selected.payload, null, 2)}
								</pre>
							</div>
							{selected.result != null && (
								<div>
									<p className="font-medium mb-1">Result</p>
									<pre className="rounded-lg bg-muted p-3 overflow-x-auto text-xs">
										{JSON.stringify(selected.result, null, 2)}
									</pre>
								</div>
							)}
							{selected.last_error && (
								<div>
									<p className="font-medium mb-1">Last error</p>
									<pre className="rounded-lg bg-muted p-3 overflow-x-auto text-xs whitespace-pre-wrap">
										{selected.last_error}
									</pre>
								</div>
							)}
							{selected.status !== "running" && selected.status !== "queued" && (
								<Button onClick={() => retry(selected.id)} disabled={busyId === selected.id}>
									{busyId === selected.id ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<RotateCcw className="mr-2 h-4 w-4" />
									)}
									Retry
								</Button>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
