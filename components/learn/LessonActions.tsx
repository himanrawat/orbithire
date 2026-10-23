"use client";

// Records that a lesson was opened (in progress) and lets the person mark it done.

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProgressStatus } from "@/lib/learn/types";

async function postProgress(lessonId: string, status: ProgressStatus) {
	const response = await fetch("/api/learn/progress", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ lessonId, status }),
	});
	if (!response.ok) throw new Error("Could not save your progress");
}

export function LessonActions({
	lessonId,
	initialStatus,
}: Readonly<{ lessonId: string; initialStatus: ProgressStatus | null }>) {
	const [status, setStatus] = useState<ProgressStatus | null>(initialStatus);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initialStatus !== null) return;
		postProgress(lessonId, "in_progress")
			.then(() => setStatus((current) => current ?? "in_progress"))
			.catch(() => undefined);
	}, [lessonId, initialStatus]);

	async function markDone() {
		setSaving(true);
		setError(null);
		try {
			await postProgress(lessonId, "done");
			setStatus("done");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save your progress");
		} finally {
			setSaving(false);
		}
	}

	if (status === "done") {
		return (
			<output className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--kind-learn)]">
				<CheckCircle2 className="h-5 w-5" aria-hidden="true" />
				Lesson done
			</output>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			<Button type="button" variant="cap" disabled={saving} onClick={() => void markDone()}>
				{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
				Mark done
			</Button>
			{error && (
				<output aria-live="polite" className="text-sm text-destructive">
					{error}
				</output>
			)}
		</div>
	);
}
