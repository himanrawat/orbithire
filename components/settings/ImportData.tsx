"use client";

import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, FileText, Loader2, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One-time imports from the old ai-job-search workflow (docs/PLAN.md §4.7):
 * tracker CSV -> applications, existing PDFs -> documents, CLAUDE.md -> profile.
 * Every import shows a dry-run preview first; nothing is written until you confirm.
 */
export function ImportData() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-xl font-semibold">Import from your old job search</h2>
				<p className="text-sm text-muted-foreground">
					Bring in applications, PDFs and your profile from an <code>ai-job-search</code> folder. Each step shows a
					preview first; nothing is saved until you confirm. Re-running an import is safe: rows that are already there
					are skipped. Order: tracker first, then PDFs (so they can be matched to applications), then profile.
				</p>
			</div>
			<TrackerImport />
			<PdfImport />
			<ProfileImport />
		</div>
	);
}

export default ImportData;

function ErrorBox({ error }: { error: string | null }) {
	if (!error) return null;
	return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
			<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
			<div>{children}</div>
		</div>
	);
}

const ACTION_VARIANT: Record<string, "success" | "warning" | "secondary"> = {
	create: "success",
	update: "warning",
	skip: "secondary",
};

function FilePick({
	accept,
	multiple,
	label,
	onFiles,
}: {
	accept: string;
	multiple?: boolean;
	label: string;
	onFiles: (files: File[]) => void;
}) {
	return (
		<label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
			<Upload className="h-4 w-4" />
			{label}
			<input
				type="file"
				accept={accept}
				multiple={multiple}
				className="sr-only"
				onChange={(e) => {
					onFiles(Array.from(e.target.files || []));
					e.target.value = "";
				}}
			/>
		</label>
	);
}

/* ------------------------------------------------------------------ tracker */

function TrackerImport() {
	const [csv, setCsv] = useState<string | null>(null);
	const [fileName, setFileName] = useState("");
	const [preview, setPreview] = useState<any | null>(null);
	const [excluded, setExcluded] = useState<Set<number>>(new Set());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<any | null>(null);

	const run = async (mode: "preview" | "apply", text = csv) => {
		if (!text) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/import/tracker", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ csv: text, mode, skip: Array.from(excluded) }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Import failed");
			if (mode === "preview") {
				setPreview(data);
				setExcluded(new Set());
				setResult(null);
			} else {
				setResult(data);
				setPreview(null);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Import failed");
		} finally {
			setBusy(false);
		}
	};

	const actionable = preview?.rows?.filter((r: any) => r.action !== "skip" && !excluded.has(r.index)).length ?? 0;

	return (
		<Card className="border-border/50 bg-card/80">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<FileSpreadsheet className="h-4 w-4" /> 1. Applications from job_search_tracker.csv
				</CardTitle>
				<CardDescription>
					Each row becomes an application (company + role). Status is mapped (drafted → saved, interview → interviewing,
					no_response → rejected, offer_declined → withdrawn); fit rating, sector and other columns go into the notes.
					Existing applications with the same company and role are only filled in, never overwritten.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<FilePick
						accept=".csv,text/csv"
						label={fileName || "Choose CSV"}
						onFiles={async ([f]) => {
							if (!f) return;
							const text = await f.text();
							setFileName(f.name);
							setCsv(text);
							void run("preview", text);
						}}
					/>
					{busy && <Loader2 className="h-4 w-4 animate-spin" />}
				</div>
				<ErrorBox error={error} />
				{result && (
					<Note>
						Imported: {result.created} created, {result.updated} updated, {result.skipped} skipped.
						{result.errors?.length ? ` Errors: ${result.errors.join("; ")}` : ""}
					</Note>
				)}
				{preview && (
					<>
						<p className="text-sm text-muted-foreground">
							Preview: {preview.summary.create} to create, {preview.summary.update} to update, {preview.summary.skip} to skip.
							Untick rows you don&apos;t want.
						</p>
						<div className="max-h-[420px] overflow-auto rounded-lg border">
							<table className="w-full text-sm">
								<thead className="sticky top-0 bg-muted text-left text-xs">
									<tr>
										<th className="p-2" />
										<th className="p-2">Action</th>
										<th className="p-2">Company</th>
										<th className="p-2">Role</th>
										<th className="p-2">Status</th>
										<th className="p-2">Fit</th>
										<th className="p-2">Details</th>
									</tr>
								</thead>
								<tbody>
									{preview.rows.map((r: any) => (
										<tr key={r.index} className={cn("border-t", excluded.has(r.index) && "opacity-50")}>
											<td className="p-2">
												<input
													type="checkbox"
													aria-label={`Import ${r.name}`}
													disabled={r.action === "skip"}
													checked={r.action !== "skip" && !excluded.has(r.index)}
													onChange={(e) => {
														const next = new Set(excluded);
														if (e.target.checked) next.delete(r.index);
														else next.add(r.index);
														setExcluded(next);
													}}
												/>
											</td>
											<td className="p-2">
												<Badge variant={ACTION_VARIANT[r.action]}>{r.action}</Badge>
											</td>
											<td className="p-2 font-medium">{r.name}</td>
											<td className="p-2">{r.job_title}</td>
											<td className="p-2 whitespace-nowrap">
												{r.tracker_status || "–"} → {r.status}
											</td>
											<td className="p-2">{r.fit_rating ?? "–"}</td>
											<td className="p-2 text-xs text-muted-foreground">{r.reason}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="flex gap-2">
							<Button onClick={() => run("apply")} disabled={busy || actionable === 0}>
								{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Import {actionable} application{actionable === 1 ? "" : "s"}
							</Button>
							<Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
								Cancel
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}

/* --------------------------------------------------------------------- PDFs */

interface PdfRow {
	file: File;
	filename: string;
	kind: "resume" | "cover_letter";
	company_id: string | null;
	confidence: string;
	title: string;
	include: boolean;
	already_imported: boolean;
	state?: "imported" | "exists" | "error" | "uploading";
	message?: string;
}

const CONFIDENCE_LABEL: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "outline" }> = {
	tracker: { label: "from tracker", variant: "success" },
	exact: { label: "exact", variant: "success" },
	role: { label: "likely", variant: "warning" },
	company: { label: "company only", variant: "warning" },
	none: { label: "no match", variant: "outline" },
};

function PdfImport() {
	const [rows, setRows] = useState<PdfRow[]>([]);
	const [companies, setCompanies] = useState<{ id: string; label: string }[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState<string | null>(null);

	const pick = async (files: File[]) => {
		const pdfs = files.filter((f) => /\.pdf$/i.test(f.name));
		if (!pdfs.length) return;
		setBusy(true);
		setError(null);
		setDone(null);
		try {
			const res = await fetch("/api/import/pdfs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ filenames: pdfs.map((f) => f.name) }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Preview failed");
			setCompanies(data.companies || []);
			setRows(
				data.files.map((m: any, i: number) => ({
					file: pdfs[i],
					filename: m.filename,
					kind: m.kind,
					company_id: m.company_id,
					confidence: m.confidence,
					title: m.title,
					include: !m.suggest_skip && !m.already_imported,
					already_imported: m.already_imported,
				}))
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Preview failed");
		} finally {
			setBusy(false);
		}
	};

	const update = (i: number, patch: Partial<PdfRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

	const importAll = async () => {
		setBusy(true);
		setError(null);
		let imported = 0;
		let existed = 0;
		let failed = 0;
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			if (!r.include || r.state === "imported") continue;
			update(i, { state: "uploading" });
			const fd = new FormData();
			fd.append("file", r.file);
			fd.append("kind", r.kind);
			fd.append("company_id", r.company_id || "");
			fd.append("title", r.title);
			try {
				const res = await fetch("/api/import/pdfs", { method: "POST", body: fd });
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
				if (data.status === "exists") existed++;
				else imported++;
				update(i, { state: data.status, message: data.status === "exists" ? "already imported" : undefined });
			} catch (err) {
				failed++;
				update(i, { state: "error", message: err instanceof Error ? err.message : "Failed" });
			}
		}
		setDone(`${imported} imported, ${existed} already there, ${failed} failed.`);
		setBusy(false);
	};

	const selected = rows.filter((r) => r.include && r.state !== "imported").length;

	return (
		<Card className="border-border/50 bg-card/80">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<FileText className="h-4 w-4" /> 2. Existing PDFs (cv/*.pdf, cover_letters/*.pdf)
				</CardTitle>
				<CardDescription>
					PDFs are stored as they are (status “PDF ready”) and marked as imported. <code>main_…</code> files become
					resumes, <code>cover_…</code> files cover letters. Check the proposed application for each file; unmatched
					files are kept unattached.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<FilePick accept=".pdf,application/pdf" multiple label="Choose PDFs" onFiles={pick} />
					{busy && <Loader2 className="h-4 w-4 animate-spin" />}
				</div>
				<ErrorBox error={error} />
				{done && <Note>{done}</Note>}
				{rows.length > 0 && (
					<>
						<div className="max-h-[480px] overflow-auto rounded-lg border">
							<table className="w-full text-sm">
								<thead className="sticky top-0 bg-muted text-left text-xs">
									<tr>
										<th className="p-2" />
										<th className="p-2">File</th>
										<th className="p-2">Type</th>
										<th className="p-2">Application</th>
										<th className="p-2">Match</th>
										<th className="p-2">Result</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((r, i) => {
										const conf = CONFIDENCE_LABEL[r.confidence] ?? CONFIDENCE_LABEL.none;
										return (
											<tr key={r.filename + i} className={cn("border-t", !r.include && "opacity-50")}>
												<td className="p-2">
													<input
														type="checkbox"
														aria-label={`Import ${r.filename}`}
														checked={r.include}
														disabled={busy || r.state === "imported"}
														onChange={(e) => update(i, { include: e.target.checked })}
													/>
												</td>
												<td className="max-w-[220px] truncate p-2 font-mono text-xs" title={r.filename}>
													{r.filename}
													{r.already_imported && <span className="ml-1 text-muted-foreground">(imported before)</span>}
												</td>
												<td className="p-2">
													<select
														className="rounded border bg-background px-1 py-0.5 text-xs"
														value={r.kind}
														disabled={busy}
														onChange={(e) => update(i, { kind: e.target.value as PdfRow["kind"] })}
													>
														<option value="resume">Resume</option>
														<option value="cover_letter">Cover letter</option>
													</select>
												</td>
												<td className="p-2">
													<select
														className="w-full max-w-[280px] rounded border bg-background px-1 py-0.5 text-xs"
														value={r.company_id || ""}
														disabled={busy}
														onChange={(e) => {
															const id = e.target.value || null;
															const label = companies.find((c) => c.id === id)?.label;
															const kindLabel = r.kind === "resume" ? "CV" : "Cover letter";
															update(i, {
																company_id: id,
																confidence: id ? "manual" : "none",
																title: label ? `${kindLabel} – ${label} (imported)` : r.title,
															});
														}}
													>
														<option value="">Unattached</option>
														{companies.map((c) => (
															<option key={c.id} value={c.id}>
																{c.label}
															</option>
														))}
													</select>
												</td>
												<td className="p-2">
													{r.confidence === "manual" ? (
														<Badge variant="secondary">chosen</Badge>
													) : (
														<Badge variant={conf.variant}>{conf.label}</Badge>
													)}
												</td>
												<td className="p-2 text-xs">
													{r.state === "uploading" && <Loader2 className="h-3 w-3 animate-spin" />}
													{r.state === "imported" && <span className="text-green-600">imported</span>}
													{r.state === "exists" && <span className="text-muted-foreground">{r.message}</span>}
													{r.state === "error" && <span className="text-destructive">{r.message}</span>}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<Button onClick={importAll} disabled={busy || selected === 0}>
							{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Import {selected} PDF{selected === 1 ? "" : "s"}
						</Button>
					</>
				)}
			</CardContent>
		</Card>
	);
}

/* ------------------------------------------------------------------ profile */

function renderValue(v: any): React.ReactNode {
	if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
		return <span className="italic text-muted-foreground">empty</span>;
	}
	if (Array.isArray(v)) {
		if (v.every((x) => typeof x === "string")) return v.join(", ");
		return (
			<ul className="space-y-1">
				{v.map((x: any, i: number) => (
					<li key={i}>
						{x.role || x.degree} · {x.company || x.institution}{" "}
						<span className="text-muted-foreground">
							({x.start_date || "?"} – {x.end_date || (x.role ? "present" : "")})
						</span>
					</li>
				))}
			</ul>
		);
	}
	return String(v);
}

function ProfileImport() {
	const [md, setMd] = useState<File | null>(null);
	const [cv, setCv] = useState<File | null>(null);
	const [rows, setRows] = useState<any[] | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState<string | null>(null);

	const preview = async () => {
		if (!md) return;
		setBusy(true);
		setError(null);
		setDone(null);
		try {
			const fd = new FormData();
			fd.append("profile", md);
			if (cv) fd.append("cv", cv);
			const res = await fetch("/api/import/profile", { method: "POST", body: fd });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not read the profile");
			setRows(data.rows);
			setSelected(new Set(data.rows.filter((r: any) => r.defaultSelected).map((r: any) => r.field)));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not read the profile");
		} finally {
			setBusy(false);
		}
	};

	const apply = async () => {
		if (!rows) return;
		setBusy(true);
		setError(null);
		try {
			const fields: Record<string, unknown> = {};
			for (const r of rows) if (selected.has(r.field)) fields[r.field] = r.proposed;
			const res = await fetch("/api/import/profile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fields }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Update failed");
			setDone(`Updated ${data.applied.length} field${data.applied.length === 1 ? "" : "s"}: ${data.applied.join(", ")}.`);
			setRows(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Update failed");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card className="border-border/50 bg-card/80">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<UserRound className="h-4 w-4" /> 3. Profile from CLAUDE.md
				</CardTitle>
				<CardDescription>
					Reads the “Candidate Profile” section (identity, experience, education, skills, targets) and, optionally, a
					recent CV for phone, website and summary. Compare current and proposed values and tick only what you want to
					replace. Fields that are empty today are pre-ticked; nothing is overwritten silently.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<FilePick accept=".md,text/markdown,text/plain" label={md?.name || "Choose CLAUDE.md"} onFiles={([f]) => f && setMd(f)} />
					<FilePick accept=".pdf,.txt,application/pdf,text/plain" label={cv?.name || "CV (optional)"} onFiles={([f]) => f && setCv(f)} />
					<Button variant="outline" onClick={preview} disabled={!md || busy}>
						{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Compare
					</Button>
				</div>
				<ErrorBox error={error} />
				{done && <Note>{done}</Note>}
				{rows && (
					<>
						<div className="overflow-auto rounded-lg border">
							<table className="w-full text-sm">
								<thead className="bg-muted text-left text-xs">
									<tr>
										<th className="p-2" />
										<th className="p-2">Field</th>
										<th className="p-2">Current</th>
										<th className="p-2">Proposed</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((r) => (
										<tr key={r.field} className={cn("border-t align-top", !r.changed && "opacity-60")}>
											<td className="p-2">
												<input
													type="checkbox"
													aria-label={`Use proposed ${r.label}`}
													disabled={!r.changed}
													checked={selected.has(r.field)}
													onChange={(e) => {
														const next = new Set(selected);
														if (e.target.checked) next.add(r.field);
														else next.delete(r.field);
														setSelected(next);
													}}
												/>
											</td>
											<td className="p-2 font-medium whitespace-nowrap">
												{r.label}
												{!r.changed && <div className="text-xs font-normal text-muted-foreground">same</div>}
											</td>
											<td className="max-w-[320px] p-2 text-xs">{renderValue(r.current)}</td>
											<td className="max-w-[320px] p-2 text-xs">{renderValue(r.proposed)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<Button onClick={apply} disabled={busy || selected.size === 0}>
							{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Apply {selected.size} selected field{selected.size === 1 ? "" : "s"}
						</Button>
					</>
				)}
			</CardContent>
		</Card>
	);
}
