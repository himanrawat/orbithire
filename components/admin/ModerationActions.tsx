"use client";

// Hide, dismiss or suspend for one report. Every action is logged on the server.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ModerationAction } from "@/lib/community/schema";

type ModerationActionsProps = Readonly<{
	reportId: string;
	canHide: boolean;
	canSuspend: boolean;
}>;

const CONFIRM: Readonly<Record<ModerationAction, string | null>> = {
	hide: null,
	dismiss: null,
	suspend: "Suspend this member from the community? They keep their account but can't read or post.",
};

async function sendAction(reportId: string, action: ModerationAction) {
	const response = await fetch(`/api/admin/moderation/${reportId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action }),
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? "Could not apply this action");
	}
}

export function ModerationActions({ reportId, canHide, canSuspend }: ModerationActionsProps) {
	const router = useRouter();
	const [busy, setBusy] = useState<ModerationAction | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function run(action: ModerationAction) {
		const prompt = CONFIRM[action];
		if (prompt && !window.confirm(prompt)) return;
		setBusy(action);
		setError(null);
		try {
			await sendAction(reportId, action);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not apply this action");
		} finally {
			setBusy(null);
		}
	}

	const spinner = (action: ModerationAction) =>
		busy === action ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null;

	return (
		<div className="flex flex-wrap items-center gap-2">
			{canHide && (
				<Button type="button" size="sm" variant="destructive" disabled={busy !== null} onClick={() => void run("hide")}>
					{spinner("hide")}
					Hide content
				</Button>
			)}
			{canSuspend && (
				<Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("suspend")}>
					{spinner("suspend")}
					Suspend member
				</Button>
			)}
			<Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("dismiss")}>
				{spinner("dismiss")}
				Dismiss
			</Button>
			{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
		</div>
	);
}
