"use client";

// Settings → Integrations: connect or disconnect Google Calendar. Hidden when the server
// has no Google client configured.

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = Readonly<{ available: boolean; connected: boolean; email: string | null }>;

const OUTCOME_MESSAGES: Readonly<Record<string, string>> = {
	connected: "Google Calendar is connected.",
	denied: "Google Calendar wasn't connected because access was declined.",
	error: "Couldn't connect Google Calendar. Try again.",
};

async function fetchStatus(): Promise<Status | null> {
	const res = await fetch("/api/calendar/google/status");
	return res.ok ? ((await res.json()) as Status) : null;
}

async function postDisconnect() {
	const res = await fetch("/api/calendar/google/disconnect", { method: "POST" });
	if (!res.ok) throw new Error("Couldn't disconnect Google Calendar. Try again.");
}

function readOutcome(): string | null {
	try {
		const value = new URLSearchParams(window.location.search).get("calendar");
		return value ? (OUTCOME_MESSAGES[value] ?? null) : null;
	} catch {
		return null;
	}
}

function description(status: Status) {
	if (status.connected) return status.email ? `Connected as ${status.email}` : "Connected";
	return "See your events in Focus and add the blocks you plan to a NextMilestone calendar.";
}

function CardAction({ status, busy, onDisconnect }: Readonly<{ status: Status; busy: boolean; onDisconnect: () => void }>) {
	if (status.connected) {
		return (
			<Button type="button" variant="outline" size="sm" disabled={busy} onClick={onDisconnect}>
				{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
				Disconnect
			</Button>
		);
	}
	return (
		<Button asChild variant="outline" size="sm">
			<a href="/api/calendar/google/connect">Connect</a>
		</Button>
	);
}

export function GoogleCalendarCard() {
	const [status, setStatus] = useState<Status | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(async () => {
		setStatus(await fetchStatus().catch(() => null));
	}, []);

	useEffect(() => {
		setMessage(readOutcome());
		void refresh();
	}, [refresh]);

	const disconnect = async () => {
		setBusy(true);
		try {
			await postDisconnect();
			setMessage("Google Calendar is disconnected and its access was revoked.");
			await refresh();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Couldn't disconnect Google Calendar.");
		} finally {
			setBusy(false);
		}
	};

	if (!status?.available) return null;

	return (
		<div className="space-y-2 rounded-lg border p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[var(--info-soft)]">
						<Image src="/g-calendar.svg" alt="" width={24} height={24} className="h-6 w-6" />
					</div>
					<div className="min-w-0">
						<p className="font-medium">Google Calendar</p>
						<p className="truncate text-sm text-muted-foreground">{description(status)}</p>
					</div>
				</div>
				<CardAction status={status} busy={busy} onDisconnect={() => void disconnect()} />
			</div>
			<output aria-live="polite" className="block text-sm text-muted-foreground">
				{message}
			</output>
		</div>
	);
}
