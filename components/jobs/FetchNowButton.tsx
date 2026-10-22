"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdaptivePolling } from "@/lib/useAdaptivePolling";

type TaskLite = {
	id: string;
	type: string;
	status: "queued" | "running" | "done" | "failed";
	last_error: string | null;
	result: Record<string, any> | null;
	created_at: string;
	updated_at: string;
};

type Status = { batch: TaskLite[]; rank: TaskLite | null; active: boolean };

function summarize(s: Status | null): string | null {
	if (!s || !s.batch.length) return null;
	if (s.active) {
		const running = s.batch.filter((t) => t.status === "running").length;
		const queued = s.batch.filter((t) => t.status === "queued").length;
		return `Fetching… ${running} running, ${queued} queued`;
	}
	let created = 0;
	let fetched = 0;
	const failed = s.batch.filter((t) => t.status === "failed").length;
	const errorSources = new Set<string>();
	for (const t of s.batch) {
		created += Number(t.result?.matches_created || 0);
		fetched += Number(t.result?.postings_kept || 0);
		for (const k of Object.keys(t.result?.errors || {})) errorSources.add(k);
	}
	const when = new Date(s.batch[0].updated_at).toLocaleString();
	let text = `Last fetch ${when}: ${fetched} jobs found, ${created} new`;
	if (failed) text += `, ${failed} task(s) failed`;
	if (errorSources.size) text += ` · errors: ${Array.from(errorSources).slice(0, 4).join(", ")}`;
	if (s.rank && (s.rank.status === "queued" || s.rank.status === "running")) text += " · ranking…";
	return text;
}

export function FetchNowButton({ onDone }: Readonly<{ onDone?: () => void }>) {
	const [status, setStatus] = useState<Status | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [starting, setStarting] = useState(false);
	const wasActive = useRef(false);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/jobs/fetch", { cache: "no-store" });
			if (!res.ok) return;
			const data: Status = await res.json();
			setStatus(data);
			const rankBusy = data.rank && (data.rank.status === "queued" || data.rank.status === "running");
			const busy = data.active || !!rankBusy;
			if (wasActive.current && !busy) onDone?.();
			wasActive.current = busy;
		} catch {
			/* ignore */
		}
	}, [onDone]);

	useEffect(() => {
		load();
	}, [load]);

	const busy = Boolean(
		status?.active ||
		(status?.rank && (status.rank.status === "queued" || status.rank.status === "running"))
	);
	useAdaptivePolling(load, { enabled: busy, intervalMs: 3000, maxIntervalMs: 30_000 });

	const start = async () => {
		setStarting(true);
		setMessage(null);
		try {
			const res = await fetch("/api/jobs/fetch", { method: "POST" });
			const data = await res.json();
			if (!res.ok) setMessage(data.message || data.error || "Could not start fetch");
			await load();
		} finally {
			setStarting(false);
		}
	};

	return (
		<div className="flex flex-col items-start gap-1 sm:items-end">
			<Button variant="cap" onClick={start} disabled={starting || !!status?.active}>
				{starting || status?.active ? (
					<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				) : (
					<RefreshCw className="mr-2 h-4 w-4" />
				)}
				Fetch now
			</Button>
			{(message || summarize(status)) && (
				<p className="max-w-md text-xs text-muted-foreground sm:text-right">
					{message || summarize(status)}
				</p>
			)}
		</div>
	);
}
