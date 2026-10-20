/**
 * Server helpers for resumes / cover letters ("documents") in v2:
 * ownership lookup, version rows, queueing Typst renders, and the legacy
 * HTML (Puppeteer) render with visible failures.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { enqueueTask } from "@/lib/tasks";
import { generatePDFFromHTML, generateCoverLetterPDF } from "@/lib/pdfGenerator";
import { generateFileKey, uploadToR2 } from "@/lib/r2";
import { serverEnv } from "@/lib/config";
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
		engine: r.engine ?? "html",
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

/**
 * Legacy HTML engine: render inline with Puppeteer and store the result.
 * Unlike the old code path, failures are recorded on the row
 * (pdf_status = failed, pdf_error) instead of being swallowed.
 */
export async function renderLegacyHtmlPdf(args: {
	type: DocumentType;
	documentId: string;
	userId: string;
	companyName: string;
	jobTitle?: string | null;
	templateId?: string | null;
	resumeJson?: unknown;
	coverLetterText?: string | null;
	candidateName?: string | null;
}): Promise<{ ok: boolean; pdfUrl?: string; error?: string }> {
	const service = createServiceSupabase();
	const table = DOCUMENT_TABLES[args.type];
	await service.from(table).update({ pdf_status: "rendering", pdf_error: null }).eq("id", args.documentId);

	let error: string | undefined;
	let pdfUrl: string | undefined;
	let pdfKey: string | undefined;
	try {
		let buffer: Buffer | undefined;
		if (args.type === "resume") {
			const renderResponse = await fetch(`${serverEnv.siteUrl}/api/resume/render`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resume: args.resumeJson, templateId: args.templateId || "compact" }),
			});
			if (!renderResponse.ok) {
				throw new Error(`HTML render failed (${renderResponse.status})`);
			}
			const { html } = await renderResponse.json();
			const pdf = await generatePDFFromHTML(html);
			if (!pdf.success || !pdf.buffer) throw new Error(pdf.error || "PDF generation failed");
			buffer = pdf.buffer;
		} else {
			const pdf = await generateCoverLetterPDF(
				args.coverLetterText || "",
				args.candidateName || "Candidate",
				args.companyName,
				args.jobTitle || "Position"
			);
			if (!pdf.success || !pdf.buffer) throw new Error(pdf.error || "PDF generation failed");
			buffer = pdf.buffer;
		}
		const key = generateFileKey(
			args.userId,
			args.type === "resume" ? "resume" : "cover-letter",
			args.companyName,
			"pdf"
		);
		const upload = await uploadToR2(buffer, key, "application/pdf");
		if (!upload.success || !upload.url) throw new Error(upload.error || "Upload failed");
		pdfUrl = upload.url;
		pdfKey = key;
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
		console.error(`[documents] legacy ${args.type} PDF failed:`, error);
	}

	await service
		.from(table)
		.update(
			error
				? { pdf_status: "failed", pdf_error: error }
				: { pdf_status: "ready", pdf_error: null, pdf_url: pdfUrl, pdf_key: pdfKey }
		)
		.eq("id", args.documentId);
	return error ? { ok: false, error } : { ok: true, pdfUrl };
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
