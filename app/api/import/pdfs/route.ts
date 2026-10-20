import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImportUser, loadUserCompanies } from "@/lib/import/server";
import { importFileKey, matchPdfFilename } from "@/lib/import/filenames";
import { isPdf, pdfToText } from "@/lib/import/pdfText";
import { uploadToR2 } from "@/lib/r2";
import { DOCUMENT_TABLES, UUID_RE } from "@/lib/documents";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 200;

/**
 * POST /api/import/pdfs
 *
 * Preview (JSON): { filenames: string[] }
 *   -> { files: [{ filename, kind, company_id, company_label, confidence, title, suggest_skip, already_imported }],
 *        companies: [{ id, label }] }
 *   Proposed application match per file (filename heuristics + the tracker's cv_file /
 *   cover_letter_file columns); the user confirms or changes it in the UI.
 *
 * Apply (multipart, one file per request): file, kind (resume|cover_letter), company_id ("" = unattached), title
 *   Stores the PDF in R2 under {user}/{resumes|cover-letters}/import-<file>.pdf and inserts a
 *   resume / cover letter with source = 'import', pdf_status = 'ready'. Re-importing the same
 *   file is a no-op (status "exists").
 */
export async function POST(req: NextRequest) {
	const auth = await getImportUser();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { supabase, userId } = auth;
	const contentType = req.headers.get("content-type") || "";

	if (contentType.includes("application/json")) {
		let body: { filenames?: unknown };
		try {
			body = await req.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}
		const names = Array.isArray(body.filenames)
			? body.filenames.filter((n): n is string => typeof n === "string" && /\.pdf$/i.test(n)).slice(0, MAX_FILES)
			: [];
		if (!names.length) return NextResponse.json({ error: "filenames (PDF) are required" }, { status: 400 });
		const companies = await loadUserCompanies(supabase, userId);
		const existing = await existingImportKeys(supabase, userId);
		const files = names.map((n) => {
			const m = matchPdfFilename(n, companies);
			return {
				filename: m.filename,
				kind: m.kind,
				company_id: m.companyId,
				company_label: m.companyLabel,
				confidence: m.confidence,
				title: m.title,
				suggest_skip: m.suggestSkip,
				already_imported: existing.has(importFileKey(userId, m.kind, m.filename)),
			};
		});
		return NextResponse.json({
			files,
			companies: companies.map((c) => ({ id: c.id, label: c.job_title ? `${c.name} – ${c.job_title}` : c.name })),
		});
	}

	if (!contentType.includes("multipart/form-data")) {
		return NextResponse.json({ error: "Send JSON (preview) or multipart/form-data (import)" }, { status: 415 });
	}
	const form = await req.formData();
	const file = form.get("file");
	if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
	if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "PDF is too large (max 10 MB)" }, { status: 413 });
	const kind = form.get("kind");
	if (kind !== "resume" && kind !== "cover_letter") {
		return NextResponse.json({ error: "kind must be resume or cover_letter" }, { status: 400 });
	}
	const companyId = String(form.get("company_id") || "");
	if (companyId) {
		if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "Invalid company_id" }, { status: 400 });
		const { data } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", userId).maybeSingle();
		if (!data) return NextResponse.json({ error: "Application not found" }, { status: 404 });
	}
	const buffer = Buffer.from(await file.arrayBuffer());
	if (!isPdf(buffer)) return NextResponse.json({ error: `${file.name} is not a PDF` }, { status: 400 });

	const docType = kind as DocumentType;
	const table = DOCUMENT_TABLES[docType];
	const key = importFileKey(userId, docType, file.name);
	const { data: dupe } = await supabase
		.from(table)
		.select("id")
		.eq("user_id", userId)
		.eq("pdf_key", key)
		.maybeSingle();
	if (dupe) return NextResponse.json({ status: "exists", id: dupe.id, type: docType });

	const upload = await uploadToR2(buffer, key, "application/pdf");
	if (!upload.success || !upload.url) {
		return NextResponse.json({ error: `Upload failed: ${upload.error || "unknown error"}` }, { status: 502 });
	}
	const text = await pdfToText(buffer);
	const rawTitle = String(form.get("title") || "").trim();
	const title = (rawTitle || file.name.replace(/\.pdf$/i, "")).slice(0, 200);
	const common = {
		user_id: userId,
		company_id: companyId || null,
		title,
		pdf_url: upload.url,
		pdf_key: key,
		pdf_status: "ready",
		pdf_error: null,
		source: "import",
		source_client: "ai-job-search",
	};
	const row =
		docType === "resume"
			? { ...common, content_json: {}, content_text: text || null }
			: { ...common, content: text };
	const { data: inserted, error } = await supabase.from(table).insert(row).select("id").single();
	if (error) {
		return NextResponse.json({ error: `Could not save the document: ${error.message}` }, { status: 500 });
	}
	return NextResponse.json({ status: "imported", id: inserted.id, type: docType, chars: text.length });
}

async function existingImportKeys(
	supabase: SupabaseClient,
	userId: string
): Promise<Set<string>> {
	const keys = new Set<string>();
	for (const table of Object.values(DOCUMENT_TABLES)) {
		const { data } = await supabase.from(table).select("pdf_key").eq("user_id", userId).eq("source", "import");
		for (const r of data || []) if (r.pdf_key) keys.add(r.pdf_key as string);
	}
	return keys;
}
