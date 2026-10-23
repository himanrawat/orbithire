"use client";

// Optional resume import inside setup. Reuses the existing profile import endpoints:
// /api/profile/extract reads the file (nothing is stored), the person reviews every
// field, and only the ticked ones are saved through /api/import/profile.

import { useId, useState, type ChangeEvent } from "react";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	buildResumeReviewRows,
	selectedFields,
	suggestedRole,
	type ReviewField,
	type ReviewRow,
} from "@/lib/onboarding/resumeReview";

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const MAX_BYTES = 5 * 1024 * 1024;

type ImportState =
	| { status: "idle" }
	| { status: "reading" }
	| { status: "review"; rows: ReviewRow[] }
	| { status: "saving"; rows: ReviewRow[] }
	| { status: "saved"; count: number };

async function readResume(file: File): Promise<{ rows: ReviewRow[] } | { error: string }> {
	const form = new FormData();
	form.append("file", file);
	try {
		const response = await fetch("/api/profile/extract", { method: "POST", body: form });
		const data = (await response.json().catch(() => ({}))) as { error?: string };
		if (!response.ok) return { error: data.error ?? "We couldn't read that file." };
		const rows = buildResumeReviewRows(data);
		return rows.length ? { rows } : { error: "We couldn't find profile details in that file." };
	} catch {
		return { error: "We couldn't reach the server. Check your connection and try again." };
	}
}

async function applyFields(fields: Record<string, unknown>): Promise<string | null> {
	try {
		const response = await fetch("/api/import/profile", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ fields }),
		});
		if (response.ok) return null;
		const data = (await response.json().catch(() => ({}))) as { error?: string };
		return data.error ?? "We couldn't save those fields.";
	} catch {
		return "We couldn't reach the server. Check your connection and try again.";
	}
}

function ReviewList({
	rows,
	selected,
	onToggle,
}: Readonly<{ rows: readonly ReviewRow[]; selected: ReadonlySet<ReviewField>; onToggle: (field: ReviewField) => void }>) {
	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 text-sm font-[550]">Review what we found. Only ticked fields are saved to your profile.</legend>
			{rows.map((row) => (
				<label
					key={row.field}
					className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border bg-card p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
				>
					<input
						type="checkbox"
						checked={selected.has(row.field)}
						onChange={() => onToggle(row.field)}
						className="mt-0.5 h-4 w-4 flex-none accent-[var(--cap)]"
					/>
					<span className="min-w-0">
						<span className="block font-semibold">{row.label}</span>
						<span className="line-clamp-3 block break-words text-muted-foreground">{row.preview}</span>
					</span>
				</label>
			))}
			<p className="text-xs text-muted-foreground">Work experience and education replace the lists on your master resume.</p>
		</fieldset>
	);
}

function toggleField(set: ReadonlySet<ReviewField>, field: ReviewField): Set<ReviewField> {
	const next = new Set(set);
	if (next.has(field)) next.delete(field);
	else next.add(field);
	return next;
}

export function ResumeImport({ onSuggestRole }: Readonly<{ onSuggestRole: (role: string) => void }>) {
	const fileId = useId();
	const [state, setState] = useState<ImportState>({ status: "idle" });
	const [selected, setSelected] = useState<Set<ReviewField>>(new Set());
	const [error, setError] = useState<string | null>(null);

	const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (file.size > MAX_BYTES) {
			setError("Files must be 5 MB or smaller.");
			return;
		}
		setError(null);
		setState({ status: "reading" });
		const result = await readResume(file);
		if ("error" in result) {
			setError(result.error);
			setState({ status: "idle" });
			return;
		}
		setSelected(new Set(result.rows.map((row) => row.field)));
		setState({ status: "review", rows: result.rows });
	};

	const save = async (rows: ReviewRow[]) => {
		setState({ status: "saving", rows });
		const failure = await applyFields(selectedFields(rows, selected));
		if (failure) {
			setError(failure);
			setState({ status: "review", rows });
			return;
		}
		const role = suggestedRole(rows);
		if (role) onSuggestRole(role);
		window.dispatchEvent(new Event("profile:updated"));
		setState({ status: "saved", count: selected.size });
	};

	return (
		<div className="grid gap-3">
			<ImportBody
				state={state}
				fileId={fileId}
				selected={selected}
				onFile={(event) => void onFile(event)}
				onToggle={(field) => setSelected((current) => toggleField(current, field))}
				onSave={(rows) => void save(rows)}
				onDiscard={() => setState({ status: "idle" })}
			/>
			{error && (
				<output aria-live="polite" className="block text-sm text-destructive">
					{error}
				</output>
			)}
		</div>
	);
}

function ImportBody({
	state,
	fileId,
	selected,
	onFile,
	onToggle,
	onSave,
	onDiscard,
}: Readonly<{
	state: ImportState;
	fileId: string;
	selected: ReadonlySet<ReviewField>;
	onFile: (event: ChangeEvent<HTMLInputElement>) => void;
	onToggle: (field: ReviewField) => void;
	onSave: (rows: ReviewRow[]) => void;
	onDiscard: () => void;
}>) {
	if (state.status === "saved") {
		return (
			<output className="flex items-center gap-2 text-sm">
				<CheckCircle2 className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
				Saved {state.count} field{state.count === 1 ? "" : "s"} to your profile.
			</output>
		);
	}
	if (state.status === "review" || state.status === "saving") {
		const saving = state.status === "saving";
		return (
			<>
				<ReviewList rows={state.rows} selected={selected} onToggle={onToggle} />
				<div className="flex flex-wrap gap-2">
					<Button type="button" onClick={() => onSave(state.rows)} disabled={saving || selected.size === 0}>
						{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						Save {selected.size} selected
					</Button>
					<Button type="button" variant="ghost" onClick={onDiscard} disabled={saving}>
						Discard
					</Button>
				</div>
			</>
		);
	}
	const reading = state.status === "reading";
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={fileId}>Resume (PDF, DOCX or TXT, up to 5 MB)</Label>
			<div className="flex items-center gap-3">
				<input
					id={fileId}
					type="file"
					accept={ACCEPT}
					onChange={onFile}
					disabled={reading}
					className="block min-h-11 w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-[var(--radius-control)] file:border file:border-input file:bg-card file:px-4 file:font-semibold"
				/>
				{reading ? (
					<Loader2 className="h-5 w-5 flex-none animate-spin" aria-label="Reading your resume" />
				) : (
					<FileUp className="h-5 w-5 flex-none text-muted-foreground" aria-hidden="true" />
				)}
			</div>
		</div>
	);
}
