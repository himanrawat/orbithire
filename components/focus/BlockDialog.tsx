"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeSelectClass } from "@/components/app/blocks";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BLOCK_KINDS, BLOCK_KIND_LABELS, type BlockKind, type CreateBlockInput, type ScheduleBlock } from "@/lib/focus/schemas";
import { fromDateTimeInputs, toDateInput, toTimeInput } from "@/lib/focus/week";

export type BlockDraft = Readonly<{ block: ScheduleBlock | null; day: Date }>;

type FormState = { kind: BlockKind; title: string; date: string; start: string; end: string };

function initialForm(draft: BlockDraft): FormState {
	if (draft.block) {
		const starts = new Date(draft.block.starts_at);
		return {
			kind: draft.block.kind,
			title: draft.block.title,
			date: toDateInput(starts),
			start: toTimeInput(starts),
			end: toTimeInput(new Date(draft.block.ends_at)),
		};
	}
	return { kind: "focus", title: "", date: toDateInput(draft.day), start: "09:00", end: "10:00" };
}

/** The block to save, or an error message for the form. */
export function toBlockInput(form: FormState): CreateBlockInput | string {
	const starts = fromDateTimeInputs(form.date, form.start);
	const ends = fromDateTimeInputs(form.date, form.end);
	if (!form.title.trim()) return "Add a title.";
	if (!starts || !ends) return "Pick a day and times.";
	if (ends <= starts) return "The end time must be after the start time.";
	return { kind: form.kind, title: form.title.trim(), starts_at: starts.toISOString(), ends_at: ends.toISOString() };
}

type BlockDialogProps = Readonly<{
	draft: BlockDraft | null;
	onClose: () => void;
	onSave: (input: CreateBlockInput, existing: ScheduleBlock | null) => Promise<void>;
}>;

export function BlockDialog({ draft, onClose, onSave }: BlockDialogProps) {
	const [form, setForm] = useState<FormState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setForm(draft ? initialForm(draft) : null);
		setError(null);
	}, [draft]);

	const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
		setForm((current) => (current ? { ...current, [key]: value } : current));

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!form || !draft) return;
		const input = toBlockInput(form);
		if (typeof input === "string") return setError(input);
		setSaving(true);
		try {
			await onSave(input, draft.block);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save the block");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{draft?.block ? "Edit block" : "New block"}</DialogTitle>
					<DialogDescription>Change the day or times to move a block.</DialogDescription>
				</DialogHeader>
				{form && (
					<form onSubmit={(event) => void submit(event)} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="block-title">Title</Label>
							<Input id="block-title" value={form.title} maxLength={200} required onChange={(e) => set("title", e.target.value)} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="block-kind">Type</Label>
							<select
								id="block-kind"
								value={form.kind}
								className={nativeSelectClass}
								onChange={(e) => set("kind", e.target.value as BlockKind)}
							>
								{BLOCK_KINDS.map((kind) => (
									<option key={kind} value={kind}>
										{BLOCK_KIND_LABELS[kind]}
									</option>
								))}
							</select>
						</div>
						<div className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-2">
								<Label htmlFor="block-date">Day</Label>
								<Input id="block-date" type="date" value={form.date} required onChange={(e) => set("date", e.target.value)} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="block-start">Starts</Label>
								<Input id="block-start" type="time" value={form.start} required onChange={(e) => set("start", e.target.value)} />
							</div>
							<div className="space-y-2">
								<Label htmlFor="block-end">Ends</Label>
								<Input id="block-end" type="time" value={form.end} required onChange={(e) => set("end", e.target.value)} />
							</div>
						</div>
						<output aria-live="polite" className="block text-sm text-[var(--danger)]">
							{error}
						</output>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={onClose}>
								Cancel
							</Button>
							<Button type="submit" disabled={saving}>
								{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
								Save block
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
