"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelectClass } from "@/components/app/blocks";
import {
	DESCRIPTION_MAX,
	MILESTONE_KINDS,
	MILESTONE_KIND_LABELS,
	TITLE_MAX,
	type MilestoneKind,
	type MilestoneVisibility,
} from "@/lib/milestones/model";
import type { MilestoneInput } from "./api";

function today(): string {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${now.getFullYear()}-${month}-${day}`;
}

export function emptyMilestoneInput(): MilestoneInput {
	return { kind: "job", title: "", description: null, happened_on: today(), visibility: "private" };
}

function submitLabel(saving: boolean, mode: "add" | "edit") {
	if (saving) return "Saving";
	return mode === "add" ? "Add milestone" : "Save changes";
}

/** Add or edit one milestone. `onSubmit` returns an error message, or null on success. */
export function MilestoneForm({
	idPrefix,
	initial,
	mode,
	onSubmit,
	onCancel,
}: Readonly<{
	idPrefix: string;
	initial: MilestoneInput;
	mode: "add" | "edit";
	onSubmit: (input: MilestoneInput) => Promise<string | null>;
	onCancel?: () => void;
}>) {
	const [value, setValue] = useState<MilestoneInput>(initial);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const set = <K extends keyof MilestoneInput>(key: K, next: MilestoneInput[K]) =>
		setValue((current) => ({ ...current, [key]: next }));

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaving(true);
		setError(null);
		const failure = await onSubmit({ ...value, description: value.description?.trim() || null });
		setSaving(false);
		if (failure) {
			setError(failure);
			return;
		}
		if (mode === "add") setValue(emptyMilestoneInput());
	};

	return (
		<form onSubmit={(event) => void submit(event)} className="grid gap-4">
			<div className="grid gap-4 sm:grid-cols-[1fr_180px]">
				<div className="grid gap-1.5">
					<Label htmlFor={`${idPrefix}-title`}>What happened</Label>
					<Input
						id={`${idPrefix}-title`}
						required
						maxLength={TITLE_MAX}
						placeholder="e.g., Started as a product designer at Acme"
						value={value.title}
						onChange={(event) => set("title", event.target.value)}
					/>
				</div>
				<div className="grid gap-1.5">
					<Label htmlFor={`${idPrefix}-date`}>Date</Label>
					<Input
						id={`${idPrefix}-date`}
						type="date"
						required
						value={value.happened_on}
						onChange={(event) => set("happened_on", event.target.value)}
					/>
				</div>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="grid gap-1.5">
					<Label htmlFor={`${idPrefix}-kind`}>Kind</Label>
					<select
						id={`${idPrefix}-kind`}
						className={nativeSelectClass}
						value={value.kind}
						onChange={(event) => set("kind", event.target.value as MilestoneKind)}
					>
						{MILESTONE_KINDS.map((kind) => (
							<option key={kind} value={kind}>
								{MILESTONE_KIND_LABELS[kind]}
							</option>
						))}
					</select>
				</div>
				<div className="grid gap-1.5">
					<Label htmlFor={`${idPrefix}-visibility`}>Who can see it</Label>
					<select
						id={`${idPrefix}-visibility`}
						className={nativeSelectClass}
						value={value.visibility}
						onChange={(event) => set("visibility", event.target.value as MilestoneVisibility)}
					>
						<option value="private">Only me</option>
						<option value="public">Public profile</option>
					</select>
				</div>
			</div>
			<div className="grid gap-1.5">
				<Label htmlFor={`${idPrefix}-description`}>Details (optional)</Label>
				<Textarea
					id={`${idPrefix}-description`}
					maxLength={DESCRIPTION_MAX}
					placeholder="What you did, what you learned, what changed."
					value={value.description ?? ""}
					onChange={(event) => set("description", event.target.value)}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" disabled={saving}>
					{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					{submitLabel(saving, mode)}
				</Button>
				{onCancel && (
					<Button type="button" variant="ghost" onClick={onCancel}>
						Cancel
					</Button>
				)}
				{error && (
					<output aria-live="polite" className="text-sm text-destructive">
						{error}
					</output>
				)}
			</div>
		</form>
	);
}
