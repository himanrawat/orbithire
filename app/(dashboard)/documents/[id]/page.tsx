"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeft, Download, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PdfStatusBadge, type PdfStatusInfo } from "@/components/PdfStatusBadge";
import { TypstPreview } from "@/components/TypstPreview";
import { VersionHistory } from "@/components/documents/VersionHistory";
import {
	DEFAULT_TYPST_COVER,
	DEFAULT_TYPST_RESUME,
	resolveTemplateId,
	type TemplateInfo,
} from "@/lib/templateCatalog";
import type { DocumentType } from "@/lib/types/database";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const paras = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

function Field({
	label,
	value,
	onChange,
	multiline,
	rows,
	placeholder,
}: {
	label: string;
	value: string | undefined;
	onChange: (v: string) => void;
	multiline?: boolean;
	rows?: number;
	placeholder?: string;
}) {
	const id = useId();
	return (
		<div className="space-y-1">
			<Label htmlFor={id} className="text-xs">{label}</Label>
			{multiline ? (
				<Textarea id={id} value={value ?? ""} rows={rows ?? 4} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="text-sm" />
			) : (
				<Input id={id} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
			)}
		</div>
	);
}

/** Editable list of objects with add/remove. */
function EntryList({
	title,
	items,
	onChange,
	empty,
	render,
}: {
	title: string;
	items: Json[];
	onChange: (items: Json[]) => void;
	empty: Json;
	render: (item: Json, set: (patch: Json) => void) => React.ReactNode;
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold">{title}</h3>
				<Button type="button" variant="ghost" size="sm" onClick={() => onChange([...items, { ...empty }])}>
					<Plus className="mr-1 h-4 w-4" /> Add
				</Button>
			</div>
			{items.map((item, i) => (
				<div key={i} className="relative space-y-2 rounded-lg border bg-background/50 p-3">
					<button
						type="button"
						className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
						onClick={() => onChange(items.filter((_, j) => j !== i))}
						aria-label={`Remove ${title} entry`}
					>
						<Trash2 className="h-4 w-4" />
					</button>
					{render(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))))}
				</div>
			))}
		</div>
	);
}

function letterFromRow(row: Json): Json {
	if (row.content_json && typeof row.content_json === "object") return row.content_json;
	return { basics: {}, recipient: { company: row.companies?.name ?? "" }, paragraphs: paras(row.content || "") };
}

export default function DocumentEditorPage() {
	const { id } = useParams<{ id: string }>();
	const search = useSearchParams();
	const typeHint = search.get("type");
	const [type, setType] = useState<DocumentType | null>(null);
	const [row, setRow] = useState<Json | null>(null);
	const [content, setContent] = useState<Json>({});
	const [catalog, setCatalog] = useState<TemplateInfo[]>([]);
	const [templateId, setTemplateId] = useState<string>("");
	const [accent, setAccent] = useState("");
	const [paper, setPaper] = useState<"a4" | "letter">("a4");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch(`/api/documents/${id}${typeHint ? `?type=${typeHint}` : ""}`);
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Failed to load document");
				const t: DocumentType = data.type;
				const r: Json = data.document;
				setType(t);
				setRow(r);
				setPdfUrl(r.pdf_url ?? null);
				const c = t === "resume" ? r.content_json || {} : letterFromRow(r);
				setContent(c);
				setAccent(c?.meta?.accent ?? "");
				setPaper(c?.meta?.paper === "letter" ? "letter" : "a4");
				const tr = await fetch(`/api/templates?kind=${t}`).then((x) => x.json());
				const list: TemplateInfo[] = tr.templates || [];
				setCatalog(list);
				// Retired HTML / imported rows: preselect the closest Typst template.
				const wanted = r.engine === "typst" ? r.template : resolveTemplateId(t, r.template);
				const fallback = t === "resume" ? DEFAULT_TYPST_RESUME : DEFAULT_TYPST_COVER;
				setTemplateId(list.some((x) => x.id === wanted) ? wanted : fallback);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load document");
			} finally {
				setLoading(false);
			}
		})();
	}, [id, typeHint]);

	const info = catalog.find((t) => t.id === templateId);
	const staticPdf = row ? row.engine !== "typst" : false;

	const previewData = useMemo(
		() => ({ ...content, meta: { ...(content.meta || {}), ...(accent ? { accent } : {}), paper } }),
		[content, accent, paper]
	);

	const set = (path: string, value: unknown) => {
		setContent((prev) => {
			const next: Json = structuredClone(prev);
			const keys = path.split(".");
			let o = next;
			for (const k of keys.slice(0, -1)) {
				if (typeof o[k] !== "object" || o[k] === null) o[k] = {};
				o = o[k];
			}
			o[keys.at(-1)!] = value;
			return next;
		});
	};

	const switchTemplate = (id: string) => {
		setTemplateId(id);
		const t = catalog.find((x) => x.id === id);
		if (t) {
			setAccent(t.accentDefault ?? "");
			setPaper(t.paperDefault);
		}
	};

	const save = async () => {
		if (!type) return;
		setSaving(true);
		setError(null);
		setMessage(null);
		try {
			const body: Json = {
				content_json: content,
				template: templateId,
				accent,
				paper,
			};
			if (type === "cover_letter") {
				const ps: string[] = content.paragraphs || [];
				body.content = [content.salutation, ...ps, content.closing, content.signature].filter(Boolean).join("\n\n");
			}
			const res = await fetch(`/api/documents/${id}?type=${type}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Save failed");
			if (data.status?.engine) setRow((r) => (r ? { ...r, engine: data.status.engine, template: data.status.template } : r));
			setMessage(
				data.render?.ok === false
					? `Saved version ${data.version ?? ""}, but the PDF could not be queued: ${data.render?.error ?? "unknown error"}`
					: `Saved version ${data.version ?? ""}. The PDF is rendering in the background.`
			);
			setRefreshKey((k) => k + 1);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}
	if (!row || !type) {
		return <div className="p-8 text-destructive">{error || "Document not found"}</div>;
	}

	const basics: Json = content.basics || {};
	const location = typeof basics.location === "object" ? basics.location?.city ?? "" : basics.location ?? "";

	return (
		<div className="container mx-auto max-w-7xl space-y-4 px-4 py-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					{row.company_id && (
						<Link href={`/companies/${row.company_id}`} className="mb-1 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
							<ChevronLeft className="h-4 w-4" /> Back to application
						</Link>
					)}
					<h1 className="text-2xl font-bold">{row.title}</h1>
					<div className="mt-1 flex items-center gap-3">
						<PdfStatusBadge
							documentId={row.id}
							documentType={type}
							initial={{ pdf_status: row.pdf_status, pdf_error: row.pdf_error, pdf_url: row.pdf_url }}
							refreshKey={refreshKey}
							onChange={(st: PdfStatusInfo) => setPdfUrl(st.pdf_url)}
						/>
						{pdfUrl && (
							<a href={pdfUrl} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
								<Download className="h-3 w-3" /> PDF
							</a>
						)}
					</div>
				</div>
				<Button onClick={save} disabled={saving}>
					{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
					Save
				</Button>
			</div>
			{row.source === "import" && staticPdf ? (
				<div className="rounded-lg border bg-muted/40 p-3 text-sm">
					This document was imported as a finished PDF and is kept exactly as uploaded. Download the PDF above, or
					fill in the form and save to render a new PDF with a template (the imported PDF is replaced).
				</div>
			) : (
				staticPdf && (
					<div className="rounded-lg border bg-muted/40 p-3 text-sm">
						This document was made with a retired template and has no editable content. Its PDF is kept as is; fill
						in the form and save to render it with a Typst template.
					</div>
				)
			)}
			{error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
			{message && <div className="rounded-lg border bg-muted/40 p-3 text-sm">{message}</div>}

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]">
				{/* ---------- form ---------- */}
				<Card className="border-border/50 bg-card/80">
					<CardContent className="space-y-6 pt-6">
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="Name" value={basics.name} onChange={(v) => set("basics.name", v)} />
							<Field label="Headline" value={basics.label} onChange={(v) => set("basics.label", v)} />
							<Field label="Email" value={basics.email} onChange={(v) => set("basics.email", v)} />
							<Field label="Phone" value={basics.phone} onChange={(v) => set("basics.phone", v)} />
							<Field label="Website" value={basics.url} onChange={(v) => set("basics.url", v)} />
							<Field
								label="Location"
								value={location}
								onChange={(v) =>
									typeof basics.location === "object" ? set("basics.location.city", v) : set("basics.location", v)
								}
							/>
						</div>

						{type === "resume" ? (
							<>
								<Field label="Summary" multiline value={basics.summary} onChange={(v) => set("basics.summary", v)} />
								<EntryList
									title="Experience"
									items={content.work || []}
									onChange={(v) => set("work", v)}
									empty={{ name: "", position: "", startDate: "", endDate: "", highlights: [] }}
									render={(w, upd) => (
										<div className="grid gap-2 sm:grid-cols-2">
											<Field label="Position" value={w.position} onChange={(v) => upd({ position: v })} />
											<Field label="Company" value={w.name} onChange={(v) => upd({ name: v })} />
											<Field label="Start (YYYY-MM)" value={w.startDate} onChange={(v) => upd({ startDate: v })} />
											<Field label="End (blank = present)" value={w.endDate} onChange={(v) => upd({ endDate: v })} />
											<div className="sm:col-span-2">
												<Field
													label="Highlights (one per line)"
													multiline
													value={(w.highlights || []).join("\n")}
													onChange={(v) => upd({ highlights: lines(v) })}
												/>
											</div>
										</div>
									)}
								/>
								<EntryList
									title="Education"
									items={content.education || []}
									onChange={(v) => set("education", v)}
									empty={{ institution: "", studyType: "", area: "", endDate: "" }}
									render={(e, upd) => (
										<div className="grid gap-2 sm:grid-cols-2">
											<Field label="Institution" value={e.institution} onChange={(v) => upd({ institution: v })} />
											<Field label="Degree" value={e.studyType} onChange={(v) => upd({ studyType: v })} />
											<Field label="Field" value={e.area} onChange={(v) => upd({ area: v })} />
											<Field label="End" value={e.endDate} onChange={(v) => upd({ endDate: v })} />
										</div>
									)}
								/>
								<EntryList
									title="Skills"
									items={content.skills || []}
									onChange={(v) => set("skills", v)}
									empty={{ name: "", keywords: [] }}
									render={(sk, upd) => (
										<div className="grid gap-2 sm:grid-cols-2">
											<Field label="Group" value={sk.name} onChange={(v) => upd({ name: v })} />
											<Field
												label="Skills (comma separated)"
												value={(sk.keywords || []).join(", ")}
												onChange={(v) => upd({ keywords: v.split(",").map((x) => x.trim()).filter(Boolean) })}
											/>
										</div>
									)}
								/>
								<EntryList
									title="Projects"
									items={content.projects || []}
									onChange={(v) => set("projects", v)}
									empty={{ name: "", url: "", highlights: [] }}
									render={(p, upd) => (
										<div className="grid gap-2 sm:grid-cols-2">
											<Field label="Name" value={p.name} onChange={(v) => upd({ name: v })} />
											<Field label="URL" value={p.url} onChange={(v) => upd({ url: v })} />
											<div className="sm:col-span-2">
												<Field
													label="Highlights (one per line)"
													multiline
													value={(p.highlights || []).join("\n")}
													onChange={(v) => upd({ highlights: lines(v) })}
												/>
											</div>
										</div>
									)}
								/>
							</>
						) : (
							<>
								<div className="grid gap-3 sm:grid-cols-3">
									<Field label="Recipient name" value={content.recipient?.name} onChange={(v) => set("recipient.name", v)} />
									<Field label="Recipient title" value={content.recipient?.title} onChange={(v) => set("recipient.title", v)} />
									<Field label="Company" value={content.recipient?.company} onChange={(v) => set("recipient.company", v)} />
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<Field label="Date" value={content.date} placeholder="YYYY-MM-DD" onChange={(v) => set("date", v)} />
									<Field label="Subject" value={content.subject} onChange={(v) => set("subject", v)} />
								</div>
								<Field label="Salutation" value={content.salutation} placeholder="Dear Hiring Manager," onChange={(v) => set("salutation", v)} />
								<Field
									label="Body (blank line between paragraphs)"
									multiline
									rows={14}
									value={(content.paragraphs || (content.content ? paras(content.content) : [])).join("\n\n")}
									onChange={(v) => {
										set("paragraphs", paras(v));
										if (content.content) set("content", undefined);
									}}
								/>
								<div className="grid gap-3 sm:grid-cols-2">
									<Field label="Closing" value={content.closing} placeholder="Sincerely," onChange={(v) => set("closing", v)} />
									<Field label="Signature" value={content.signature} onChange={(v) => set("signature", v)} />
								</div>
							</>
						)}
					</CardContent>
				</Card>

				{/* ---------- preview ---------- */}
				<aside className="space-y-3 lg:sticky lg:top-4">
					<Card className="border-border/50 bg-card/80">
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Template & preview</CardTitle>
							<CardDescription>Live preview of page 1. Saving renders the PDF in the background.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex flex-wrap items-end gap-3">
								<div className="space-y-1">
									<Label className="text-xs">Template</Label>
									<Select value={templateId} onValueChange={switchTemplate}>
										<SelectTrigger className="h-8 w-52 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{catalog.map((t) => (
												<SelectItem key={t.id} value={t.id}>
													{t.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								{info?.accentCustomizable && (
									<div className="space-y-1">
										<Label className="text-xs">Accent</Label>
										<input
											type="color"
											value={accent || info.accentDefault || "#1f4e79"}
											onChange={(e) => setAccent(e.target.value)}
											className="h-8 w-12 cursor-pointer rounded border bg-transparent"
											aria-label="Accent colour"
										/>
									</div>
								)}
								<div className="space-y-1">
									<Label className="text-xs">Paper</Label>
									<Select value={paper} onValueChange={(v) => setPaper(v as "a4" | "letter")}>
										<SelectTrigger className="h-8 w-24 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="a4">A4</SelectItem>
											<SelectItem value="letter">Letter</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
							<TypstPreview
								documentId={row.id}
								templateId={templateId || (type === "resume" ? DEFAULT_TYPST_RESUME : DEFAULT_TYPST_COVER)}
								data={previewData}
								accent={accent || null}
								paper={paper}
							/>
						</CardContent>
					</Card>
					<VersionHistory
						documentId={row.id}
						documentType={type}
						templateId={templateId || (type === "resume" ? DEFAULT_TYPST_RESUME : DEFAULT_TYPST_COVER)}
						paper={paper}
						currentContent={previewData}
						refreshKey={refreshKey}
						onRestored={(doc, msg) => {
							if (doc) {
								setRow(doc);
								const c = type === "resume" ? doc.content_json || {} : letterFromRow(doc);
								setContent(c);
								setAccent(c?.meta?.accent ?? "");
								setPaper(c?.meta?.paper === "letter" ? "letter" : "a4");
							}
							setMessage(msg);
							setError(null);
							setRefreshKey((k) => k + 1);
						}}
					/>
				</aside>
			</div>
		</div>
	);
}
