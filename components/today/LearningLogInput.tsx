"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SaveState = "idle" | "saving" | "saved" | "error";

async function saveEntry(note: string): Promise<boolean> {
	const res = await fetch("/api/today/learning", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ note }),
	});
	return res.ok;
}

const STATUS_TEXT: Record<SaveState, string> = {
	idle: "",
	saving: "Saving…",
	saved: "Saved to your learning log.",
	error: "Couldn't save that. Try again in a moment.",
};

/** Quick learning-log input. Rendered only once the learning_entries table exists. */
export function LearningLogInput() {
	const [note, setNote] = useState("");
	const [state, setState] = useState<SaveState>("idle");

	async function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const trimmed = note.trim();
		if (!trimmed) return;
		setState("saving");
		const ok = await saveEntry(trimmed).catch(() => false);
		setState(ok ? "saved" : "error");
		if (ok) setNote("");
	}

	return (
		<section aria-labelledby="learning-heading" className="rounded-[var(--radius-md)] border bg-card p-5">
			<h2 id="learning-heading" className="mb-3 font-display text-lg font-[650]">
				What did you learn today?
			</h2>
			<form className="flex gap-2" onSubmit={(e) => void handleSubmit(e)}>
				<label htmlFor="learning-note" className="sr-only">
					Learning note
				</label>
				<Input
					id="learning-note"
					value={note}
					maxLength={500}
					placeholder="One line is plenty"
					onChange={(e) => setNote(e.target.value)}
				/>
				<Button type="submit" variant="outline" disabled={state === "saving" || !note.trim()}>
					Save
				</Button>
			</form>
			<output aria-live="polite" className="mt-2 block text-sm text-muted-foreground">
				{STATUS_TEXT[state]}
			</output>
		</section>
	);
}
