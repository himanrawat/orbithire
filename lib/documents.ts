/**
 * Server helpers for resumes / cover letters ("documents") in v2:
 * ownership lookup, version rows and queueing Typst renders (render_pdf).
 *
 * Rows with engine = 'html' are retired: imported PDFs or legacy rows without
 * structured content. They keep their stored PDF and are never re-rendered
 * until the user saves structured content, which converts them to Typst.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { enqueueTask } from "@/lib/tasks";
import { resolveTemplateId } from "@/lib/templateCatalog";
import type { DocumentEngine, DocumentType, PdfStatus } from "@/lib/types/database";

export const DOCUMENT_TABLES: Record<DocumentType, "resumes" | "cover_letters"> = {
	resume: "resumes",
	cover_letter: "cover_letters",
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OwnedDocument {
	type: DocumentType;
	table: "resumes" | "cover_letters";
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	row: Record<string, any>;
}

export interface DocumentStatus {
	id: string;
	type: DocumentType;
	engine: DocumentEngine;
	template: string;
	pdf_status: PdfStatus;
	pdf_error: string | null;
	pdf_url: string | null;
	updated_at: string;
}

/** Find a resume or cover letter by id, owned by `userId` (uses the caller's RLS client). */
export async function findOwnedDocument(
	supabase: SupabaseClient,
	id: string,
	userId: string,
	typeHint?: DocumentType | null
): Promise<OwnedDocument | null> {
	if (!UUID_RE.test(id)) return null;
	const order: DocumentType[] =
		typeHint === "cover_letter" ? ["cover_letter", "resume"] : ["resume", "cover_letter"];
	for (const type of order) {
		const table = DOCUMENT_TABLES[type];
		const { data } = await supabase
			.from(table)
			.select("*, companies(name, recruiter_name)")
			.eq("id", id)
			.eq("user_id", userId)
			.maybeSingle();
		if (data) return { type, table, row: data };
	}
	return null;
}

export function toStatus(doc: OwnedDocument): DocumentStatus {
	const r = doc.row;
	return {
		id: r.id,
		type: doc.type,
		engine: r.engine ?? "typst",
		template: r.template,
		pdf_status: r.pdf_status ?? "none",
		pdf_error: r.pdf_error ?? null,
		pdf_url: r.pdf_url ?? null,
		updated_at: r.updated_at,
	};
}

/** Insert a document_versions row (version number is assigned by a trigger). */
export async function insertDocumentVersion(
	supabase: SupabaseClient,
	args: {
		userId: string;
		type: DocumentType;
		documentId: string;
		contentJson: unknown;
		source?: "portal" | "mcp" | "import";
	}
): Promise<number | null> {
	const { data, error } = await supabase
		.from("document_versions")
		.insert({
			user_id: args.userId,
			document_type: args.type,
			document_id: args.documentId,
			content_json: args.contentJson ?? {},
			source: args.source ?? "portal",
		})
		.select("version")
		.single();
	if (error) {
		console.error("[documents] version insert failed:", error.message);
		return null;
	}
	return (data as { version: number }).version;
}

/**
 * Mark the row queued and enqueue a `render_pdf` task. Returns immediately;
 * the worker sets rendering -> ready/failed. Errors are written to the row.
 */
export async function queueTypstRender(args: {
	type: DocumentType;
	documentId: string;
	userId: string;
	templateId?: string | null;
	accent?: string | null;
	paper?: string | null;
}): Promise<{ ok: boolean; taskId?: string; error?: string }> {
	const service = createServiceSupabase();
	const table = DOCUMENT_TABLES[args.type];
	await service
		.from(table)
		.update({ pdf_status: "queued", pdf_error: null, updated_at: new Date().toISOString() })
		.eq("id", args.documentId)
		.eq("user_id", args.userId);
	const payload: Record<string, unknown> = {
		document_type: args.type,
		document_id: args.documentId,
	};
	if (args.templateId) payload.template_id = args.templateId;
	if (args.accent) payload.accent = args.accent;
	if (args.paper) payload.paper = args.paper;
	try {
		const taskId = await enqueueTask("render_pdf", payload, {
			userId: args.userId,
			priority: 5,
			client: service,
		});
		return { ok: true, taskId };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Failed to queue PDF render";
		console.error("[documents] enqueue render_pdf failed:", message);
		await service
			.from(table)
			.update({ pdf_status: "failed", pdf_error: `Could not queue render: ${message}` })
			.eq("id", args.documentId);
		return { ok: false, error: message };
	}
}

/** True when the row has content a Typst template can render. */
export function hasRenderableContent(
	type: DocumentType,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	row: { content_json?: any; content?: string | null }
): boolean {
	const cj = row.content_json;
	const hasJson =
		!!cj && typeof cj === "object" && !Array.isArray(cj) && Object.keys(cj).some((k) => k !== "meta");
	if (type === "resume") return hasJson;
	return hasJson || (typeof row.content === "string" && row.content.trim() !== "");
}

/** The Typst template a retired HTML row maps to (same table as migration 027). */
export function typstTemplateFor(type: DocumentType, row: { engine?: string | null; template?: string | null }): string {
	return row.engine === "typst" && row.template
		? row.template
		: resolveTemplateId(type, row.template ? `html:${row.template}` : "");
}

/**
 * Make a document renderable with Typst before a re-render.
 * - Typst rows: returns their template.
 * - Imported PDFs and retired HTML rows without content: returns null with a
 *   reason – their stored PDF is kept and never re-rendered.
 * - Retired HTML rows with content (normally converted by migration 027):
 *   switched to engine = 'typst' with the mapped template.
 */
export async function ensureTypstDocument(
	doc: OwnedDocument
): Promise<{ template: string } | { template: null; reason: string }> {
	const r = doc.row;
	if (r.engine === "typst") return { template: r.template };
	if (r.source === "import") {
		return { template: null, reason: "Imported PDFs are kept as uploaded and are not re-rendered." };
	}
	if (!hasRenderableContent(doc.type, r)) {
		return { template: null, reason: "This document has no editable content to render; its stored PDF is kept." };
	}
	const template = typstTemplateFor(doc.type, r);
	const { error } = await createServiceSupabase()
		.from(doc.table)
		.update({ engine: "typst", template })
		.eq("id", r.id)
		.eq("user_id", r.user_id);
	if (error) return { template: null, reason: `Could not convert the document: ${error.message}` };
	r.engine = "typst";
	r.template = template;
	return { template };
}

/** Plain-text cover letter -> structured content_json for Typst templates. */
export function coverLetterJsonFromText(args: {
	text: string;
	basics?: Record<string, unknown> | null;
	companyName?: string | null;
	recruiterName?: string | null;
	jobTitle?: string | null;
}): Record<string, unknown> {
	const recipient: Record<string, string> = {};
	if (args.recruiterName) recipient.name = args.recruiterName;
	if (args.companyName) recipient.company = args.companyName;
	return {
		basics: args.basics ?? {},
		recipient,
		date: new Date().toISOString().slice(0, 10),
		subject: args.jobTitle ? `Application for ${args.jobTitle}` : "",
		content: args.text,
	};
}

/** Contact basics of a JSON Resume, flattened for a letter header. */
export function letterBasicsFromResume(resume: unknown): Record<string, string> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const b = (resume as any)?.basics;
	if (!b || typeof b !== "object") return {};
	const loc =
		typeof b.location === "string"
			? b.location
			: [b.location?.city, b.location?.region].filter(Boolean).join(", ");
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries({
		name: b.name,
		label: b.label,
		email: b.email,
		phone: b.phone,
		url: b.url,
		location: loc,
	})) {
		if (typeof v === "string" && v) out[k] = v;
	}
	return out;
}

/**
 * Create a NEW Typst resume / cover letter row, write its first
 * document_versions row and enqueue `render_pdf` (returns immediately with
 * pdf_status = queued). Never touches existing documents.
 *
 * Used by the MCP save_resume / save_cover_letter tools. `supabase` may be the
 * service-role client: every write is scoped to `userId` explicitly.
 */
export async function createTypstDocument(
	supabase: SupabaseClient,
	args: {
		type: DocumentType;
		userId: string;
		title: string;
		templateId: string;
		contentJson: Record<string, unknown>;
		source: "portal" | "mcp" | "import";
		sourceClient?: string | null;
		companyId?: string | null;
		jobPostingId?: string | null;
		jobDescription?: string | null;
		resumeId?: string | null;
		/** Cover letters: plain-text copy for legacy views (cover_letters.content). */
		plainText?: string | null;
	}
): Promise<{ id: string; version: number | null; pdfStatus: PdfStatus; renderError?: string }> {
	const table = DOCUMENT_TABLES[args.type];
	const row: Record<string, unknown> = {
		user_id: args.userId,
		title: args.title.slice(0, 300),
		content_json: args.contentJson,
		template: args.templateId,
		engine: "typst",
		source: args.source,
		source_client: args.sourceClient ?? null,
		company_id: args.companyId ?? null,
		job_posting_id: args.jobPostingId ?? null,
		job_description: args.jobDescription ?? null,
		pdf_status: "queued",
	};
	if (args.type === "cover_letter" && args.resumeId) row.resume_id = args.resumeId;
	if (args.type === "cover_letter" && args.plainText) row.content = args.plainText;

	const { data, error } = await supabase.from(table).insert(row).select("id").single();
	if (error || !data) {
		throw new Error(`Failed to save ${args.type.replace("_", " ")}: ${error?.message ?? "no row"}`);
	}
	const id = (data as { id: string }).id;
	const version = await insertDocumentVersion(supabase, {
		userId: args.userId,
		type: args.type,
		documentId: id,
		contentJson: args.contentJson,
		source: args.source,
	});
	const render = await queueTypstRender({
		type: args.type,
		documentId: id,
		userId: args.userId,
		templateId: args.templateId,
	});
	return render.ok
		? { id, version, pdfStatus: "queued" }
		: { id, version, pdfStatus: "failed", renderError: render.error };
}
