"use client";

// The bottom bar's Log (+) sheet: save a learning link or note in a few taps. Offline (or on
// a network error) the entry waits in the outbox and syncs when the phone is back online.

import { useState, type FormEvent } from "react";
import { Link2, Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { tabClass, tabListClass } from "@/components/app/blocks";
import { LEARN_LIMITS, type EntryKind } from "@/lib/learn/types";
import { learnLogQueue } from "@/lib/pwa/logQueue";
import type { QueuedLogEntry } from "@/lib/pwa/schemas";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; offline: boolean } | { kind: "error"; message: string };

function buildEntry(kind: EntryKind, url: string, note: string): QueuedLogEntry {
	const clientId = crypto.randomUUID();
	const trimmedNote = note.trim();
	if (kind === "link") {
		return { client_id: clientId, kind: "link", url: url.trim(), ...(trimmedNote ? { note: trimmedNote } : {}) };
	}
	return { client_id: clientId, kind: "note", note: trimmedNote };
}

/** "online" | "offline" (queued) | an error message from the server. */
async function saveEntry(entry: QueuedLogEntry): Promise<"online" | "offline" | string> {
	const body: Record<string, unknown> = { ...entry };
	delete body.client_id;
	if (!navigator.onLine) {
		learnLogQueue.enqueue(entry);
		return "offline";
	}
	try {
		const response = await fetch("/api/learn/entries", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (response.ok) return "online";
		const data = (await response.json().catch(() => null)) as { error?: string } | null;
		return data?.error ?? "Could not save this entry";
	} catch {
		learnLogQueue.enqueue(entry);
		return "offline";
	}
}

function StatusLine({ status }: Readonly<{ status: Status }>) {
	if (status.kind === "saved") {
		return (
			<output aria-live="polite" className="block text-sm">
				{status.offline ? "Saved on this phone. It syncs when you're back online." : "Saved to your learning log."}
			</output>
		);
	}
	if (status.kind === "error") {
		return (
			<output aria-live="polite" className="block text-sm text-destructive">
				{status.message}
			</output>
		);
	}
	return null;
}

function KindToggle({ kind, onChange }: Readonly<{ kind: EntryKind; onChange: (kind: EntryKind) => void }>) {
	return (
		<fieldset>
			<legend className="sr-only">What are you logging?</legend>
			<div className={tabListClass}>
				<label className={tabClass(kind === "link")}>
					<input type="radio" name="quick-log-kind" value="link" className="sr-only" checked={kind === "link"} onChange={() => onChange("link")} />
					<Link2 className="h-4 w-4" aria-hidden="true" />
					Link
				</label>
				<label className={tabClass(kind === "note")}>
					<input type="radio" name="quick-log-kind" value="note" className="sr-only" checked={kind === "note"} onChange={() => onChange("note")} />
					<NotebookPen className="h-4 w-4" aria-hidden="true" />
					Note
				</label>
			</div>
		</fieldset>
	);
}

export function QuickLogSheet({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void }>) {
	const [kind, setKind] = useState<EntryKind>("note");
	const [url, setUrl] = useState("");
	const [note, setNote] = useState("");
	const [status, setStatus] = useState<Status>({ kind: "idle" });

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setStatus({ kind: "saving" });
		const result = await saveEntry(buildEntry(kind, url, note));
		if (result === "online" || result === "offline") {
			setUrl("");
			setNote("");
			setStatus({ kind: "saved", offline: result === "offline" });
			return;
		}
		setStatus({ kind: "error", message: result });
	}

	const isLink = kind === "link";
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) setStatus({ kind: "idle" });
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-sm:bottom-[calc(16px+env(safe-area-inset-bottom))] max-sm:top-auto max-sm:translate-y-0">
				<DialogHeader>
					<DialogTitle>Log what you learned</DialogTitle>
					<DialogDescription>A link or a quick note. It stays private until you share it.</DialogDescription>
				</DialogHeader>
				<form onSubmit={(event) => void submit(event)} className="space-y-4">
					<KindToggle kind={kind} onChange={setKind} />
					{isLink && (
						<div className="space-y-1.5">
							<Label htmlFor="quick-log-url">Link</Label>
							<Input
								id="quick-log-url"
								type="url"
								inputMode="url"
								required
								maxLength={LEARN_LIMITS.urlLength}
								placeholder="https://"
								value={url}
								onChange={(event) => setUrl(event.target.value)}
							/>
						</div>
					)}
					<div className="space-y-1.5">
						<Label htmlFor="quick-log-note">{isLink ? "Note (optional)" : "What did you learn?"}</Label>
						<Textarea
							id="quick-log-note"
							required={!isLink}
							maxLength={LEARN_LIMITS.noteLength}
							value={note}
							onChange={(event) => setNote(event.target.value)}
						/>
					</div>
					<StatusLine status={status} />
					<Button type="submit" className="min-h-11 w-full" disabled={status.kind === "saving"}>
						{status.kind === "saving" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						Save
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
