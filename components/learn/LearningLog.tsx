"use client";

// The learning log: add a link (title fetched on the server) or a note, with tags.
// Entries are private by default; "Share to profile" makes one public.

import { useState, type FormEvent } from "react";
import { ExternalLink, Link2, Loader2, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionHeader, tabClass, tabListClass } from "@/components/app/blocks";
import { LocalDate } from "@/components/LocalDate";
import { LEARN_LIMITS, type EntryKind, type LearningEntry, type Visibility } from "@/lib/learn/types";

type Draft = { kind: EntryKind; url: string; note: string; tags: string };

const EMPTY_DRAFT: Draft = { kind: "link", url: "", note: "", tags: "" };

function splitTags(raw: string) {
	return raw
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean)
		.slice(0, LEARN_LIMITS.tags);
}

function draftToBody(draft: Draft) {
	const tags = splitTags(draft.tags);
	const note = draft.note.trim();
	if (draft.kind === "link") return { kind: "link", url: draft.url.trim(), tags, ...(note ? { note } : {}) };
	return { kind: "note", note, tags };
}

async function readError(response: Response, fallback: string) {
	const body = (await response.json().catch(() => null)) as { error?: string } | null;
	return body?.error ?? fallback;
}

async function createEntry(draft: Draft): Promise<LearningEntry> {
	const response = await fetch("/api/learn/entries", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(draftToBody(draft)),
	});
	if (!response.ok) throw new Error(await readError(response, "Could not save this entry"));
	return ((await response.json()) as { entry: LearningEntry }).entry;
}

async function patchVisibility(id: string, visibility: Visibility): Promise<LearningEntry> {
	const response = await fetch(`/api/learn/entries/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ visibility }),
	});
	if (!response.ok) throw new Error(await readError(response, "Could not update sharing"));
	return ((await response.json()) as { entry: LearningEntry }).entry;
}

async function removeEntry(id: string) {
	const response = await fetch(`/api/learn/entries/${id}`, { method: "DELETE" });
	if (!response.ok) throw new Error(await readError(response, "Could not delete this entry"));
}

function KindPicker({ kind, onChange }: Readonly<{ kind: EntryKind; onChange: (kind: EntryKind) => void }>) {
	return (
		<fieldset>
			<legend className="sr-only">What are you logging?</legend>
			<div className={tabListClass}>
				<label className={tabClass(kind === "link")}>
					<input type="radio" name="kind" value="link" className="sr-only" checked={kind === "link"} onChange={() => onChange("link")} />
					<Link2 className="h-4 w-4" aria-hidden="true" />
					Link
				</label>
				<label className={tabClass(kind === "note")}>
					<input type="radio" name="kind" value="note" className="sr-only" checked={kind === "note"} onChange={() => onChange("note")} />
					<NotebookPen className="h-4 w-4" aria-hidden="true" />
					Note
				</label>
			</div>
		</fieldset>
	);
}

function EntryForm({ onCreated }: Readonly<{ onCreated: (entry: LearningEntry) => void }>) {
	const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			onCreated(await createEntry(draft));
			setDraft({ ...EMPTY_DRAFT, kind: draft.kind });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save this entry");
		} finally {
			setSaving(false);
		}
	}

	const isLink = draft.kind === "link";
	return (
		<form onSubmit={(event) => void submit(event)} className="space-y-4">
			<KindPicker kind={draft.kind} onChange={(kind) => update({ kind })} />
			{isLink && (
				<div className="space-y-1.5">
					<Label htmlFor="learn-url">Link</Label>
					<Input
						id="learn-url"
						type="url"
						inputMode="url"
						required
						maxLength={LEARN_LIMITS.urlLength}
						placeholder="https://developer.mozilla.org/…"
						value={draft.url}
						onChange={(event) => update({ url: event.target.value })}
					/>
					<p className="text-[13px] text-muted-foreground">We&apos;ll fetch the page title for you.</p>
				</div>
			)}
			<div className="space-y-1.5">
				<Label htmlFor="learn-note">{isLink ? "Note (optional)" : "What did you learn?"}</Label>
				<Textarea
					id="learn-note"
					required={!isLink}
					maxLength={LEARN_LIMITS.noteLength}
					placeholder={isLink ? "Why it's worth keeping" : "Two or three sentences in your own words"}
					value={draft.note}
					onChange={(event) => update({ note: event.target.value })}
				/>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="learn-tags">Tags</Label>
				<Input
					id="learn-tags"
					placeholder="react, performance"
					value={draft.tags}
					onChange={(event) => update({ tags: event.target.value })}
				/>
				<p className="text-[13px] text-muted-foreground">Separate with commas. Up to {LEARN_LIMITS.tags}.</p>
			</div>
			<div className="flex flex-wrap items-center gap-3">
				<Button type="submit" variant="cap" disabled={saving}>
					{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					Save to log
				</Button>
				<p className="text-[13px] text-muted-foreground">Private unless you share it.</p>
			</div>
			{error && (
				<output aria-live="polite" className="block text-sm text-destructive">
					{error}
				</output>
			)}
		</form>
	);
}

function EntryTitle({ entry }: Readonly<{ entry: LearningEntry }>) {
	const title = entry.title ?? (entry.kind === "note" ? "Note" : entry.url);
	if (entry.kind === "link" && entry.url) {
		return (
			<a
				href={entry.url}
				target="_blank"
				rel="noopener noreferrer nofollow"
				className="inline-flex items-start gap-1.5 font-semibold hover:underline"
			>
				<span className="break-words">{title}</span>
				<ExternalLink className="mt-1 h-3.5 w-3.5 flex-none text-muted-foreground" aria-hidden="true" />
				<span className="sr-only">(opens in a new tab)</span>
			</a>
		);
	}
	return <p className="font-semibold">{title}</p>;
}

type EntryActions = Readonly<{
	onShare: (entry: LearningEntry, shared: boolean) => Promise<void>;
	onDelete: (entry: LearningEntry) => Promise<void>;
}>;

function EntryRow({ entry, onShare, onDelete }: Readonly<{ entry: LearningEntry }> & EntryActions) {
	const shareId = `share-${entry.id}`;
	return (
		<li className="rounded-[var(--radius-md)] border bg-card p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<EntryTitle entry={entry} />
					{entry.note && <p className="mt-1 whitespace-pre-line text-sm leading-5 text-muted-foreground">{entry.note}</p>}
					<div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
						<LocalDate value={entry.created_at} />
						{entry.tags.map((tag) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
					</div>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={`Delete ${entry.title ?? "entry"}`}
					onClick={() => void onDelete(entry)}
				>
					<Trash2 className="h-4 w-4" aria-hidden="true" />
				</Button>
			</div>
			<div className="mt-3 flex items-center gap-2 border-t pt-3">
				<input
					id={shareId}
					type="checkbox"
					className="h-4 w-4 accent-[var(--kind-learn)]"
					checked={entry.visibility === "public"}
					onChange={(event) => void onShare(entry, event.target.checked)}
				/>
				<label htmlFor={shareId} className="text-[13px] font-medium">
					Share to profile
				</label>
			</div>
		</li>
	);
}

export function LearningLog({ initialEntries }: Readonly<{ initialEntries: LearningEntry[] }>) {
	const [entries, setEntries] = useState<LearningEntry[]>(initialEntries);
	const [error, setError] = useState<string | null>(null);

	const replace = (next: LearningEntry) =>
		setEntries((current) => current.map((entry) => (entry.id === next.id ? next : entry)));

	async function share(entry: LearningEntry, shared: boolean) {
		setError(null);
		try {
			replace(await patchVisibility(entry.id, shared ? "public" : "private"));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not update sharing");
		}
	}

	async function remove(entry: LearningEntry) {
		setError(null);
		try {
			await removeEntry(entry.id);
			setEntries((current) => current.filter((item) => item.id !== entry.id));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not delete this entry");
		}
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
			<Card>
				<CardContent className="pt-6">
					<SectionHeader title="Log something" description="A link you read or a note on what you learned." />
					<EntryForm onCreated={(entry) => setEntries((current) => [entry, ...current])} />
				</CardContent>
			</Card>
			<section aria-labelledby="learn-log-heading">
				<h2 id="learn-log-heading" className="mb-4 font-display text-lg font-[650]">
					Your log
				</h2>
				{error && (
					<output aria-live="polite" className="mb-3 block text-sm text-destructive">
						{error}
					</output>
				)}
				{entries.length === 0 ? (
					<EmptyState title="Nothing logged yet" description="Save the next article, video or idea worth keeping." />
				) : (
					<ul className="space-y-3">
						{entries.map((entry) => (
							<EntryRow key={entry.id} entry={entry} onShare={share} onDelete={remove} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
