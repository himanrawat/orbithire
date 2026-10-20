import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
	findOwnedDocument,
	insertDocumentVersion,
	queueTypstRender,
	renderLegacyHtmlPdf,
	toStatus,
} from "@/lib/documents";
import { getTypstTemplate } from "@/lib/typstTemplates";
import { ACCENT_RE, HTML_TEMPLATES } from "@/lib/templateCatalog";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_BYTES = 1_000_000;

function typeHint(req: NextRequest): DocumentType | null {
	const t = req.nextUrl.searchParams.get("type");
	return t === "resume" || t === "cover_letter" ? t : null;
}

// GET /api/documents/[id] – the document (resume or cover letter) + PDF status
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const doc = await findOwnedDocument(supabase, params.id, user.id, typeHint(req));
	if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
	return NextResponse.json({ type: doc.type, document: doc.row, status: toStatus(doc) });
}

/**
 * PUT /api/documents/[id] – save from the portal editor.
 * Body: { content_json, engine?: "typst"|"html", template?, accent?, paper?, content? }
 * Writes a document_versions row. Typst: enqueues render_pdf and returns
 * immediately (pdf_status = queued). HTML: renders inline (legacy) and records
 * failures on the row.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const doc = await findOwnedDocument(supabase, params.id, user.id, typeHint(req));
	if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

	let body: Record<string, unknown>;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const content = body.content_json;
	if (!content || typeof content !== "object" || Array.isArray(content)) {
		return NextResponse.json({ error: "content_json must be an object" }, { status: 400 });
	}
	if (JSON.stringify(content).length > MAX_CONTENT_BYTES) {
		return NextResponse.json({ error: "Document is too large" }, { status: 413 });
	}

	const engine = body.engine === "typst" || body.engine === "html" ? body.engine : doc.row.engine || "html";
	const template = typeof body.template === "string" && body.template ? body.template : doc.row.template;
	if (engine === "typst") {
		const t = await getTypstTemplate(template);
		if (!t) return NextResponse.json({ error: `Unknown Typst template: ${template}` }, { status: 400 });
		if (t.kind !== doc.type) {
			return NextResponse.json({ error: `${t.name} is not a ${doc.type.replace("_", " ")} template` }, { status: 400 });
		}
	} else if (doc.type === "resume" && !HTML_TEMPLATES.some((t) => t.id === template)) {
		return NextResponse.json({ error: `Unknown HTML template: ${template}` }, { status: 400 });
	}

	// accent / paper live in content_json.meta (the templates read them from there too)
	const contentJson = { ...(content as Record<string, unknown>) };
	const meta = { ...((contentJson.meta as Record<string, unknown>) || {}) };
	if (typeof body.accent === "string") {
		if (body.accent && !ACCENT_RE.test(body.accent)) {
			return NextResponse.json({ error: "accent must be #RRGGBB" }, { status: 400 });
		}
		if (body.accent) meta.accent = body.accent;
		else delete meta.accent;
	}
	if (body.paper === "a4" || body.paper === "letter") meta.paper = body.paper;
	if (Object.keys(meta).length > 0) contentJson.meta = meta;

	const update: Record<string, unknown> = {
		content_json: contentJson,
		engine,
		template,
		updated_at: new Date().toISOString(),
	};
	if (doc.type === "cover_letter" && typeof body.content === "string") {
		update.content = body.content;
	}
	const { error: updateError } = await supabase.from(doc.table).update(update).eq("id", doc.row.id);
	if (updateError) {
		console.error("[documents PUT] update failed:", updateError);
		return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
	}

	const version = await insertDocumentVersion(supabase, {
		userId: user.id,
		type: doc.type,
		documentId: doc.row.id,
		contentJson,
	});

	let render: { ok: boolean; error?: string };
	if (engine === "typst") {
		render = await queueTypstRender({ type: doc.type, documentId: doc.row.id, userId: user.id, templateId: template });
	} else {
		const companyName = doc.row.companies?.name || doc.row.title || "document";
		render = await renderLegacyHtmlPdf({
			type: doc.type,
			documentId: doc.row.id,
			userId: user.id,
			companyName,
			templateId: template,
			resumeJson: contentJson,
			coverLetterText: (update.content as string) ?? doc.row.content,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			candidateName: (contentJson as any)?.basics?.name,
		});
	}

	const fresh = await findOwnedDocument(supabase, doc.row.id, user.id, doc.type);
	return NextResponse.json({
		ok: true,
		version,
		render,
		status: fresh ? toStatus(fresh) : null,
	});
}
