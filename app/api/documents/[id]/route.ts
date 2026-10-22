import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
	findOwnedDocument,
	insertDocumentVersion,
	queueTypstRender,
	toStatus,
	typstTemplateFor,
} from "@/lib/documents";
import { getTypstTemplate } from "@/lib/typstTemplates";
import { ACCENT_RE, resolveTemplateId } from "@/lib/templateCatalog";
import type { DocumentType } from "@/lib/types/database";
import { parseJson } from "@/lib/api";
import { documentUpdateSchema } from "@/lib/schemas/api";

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
 * Body: { content_json, template?, accent?, paper?, content? }
 * Writes a document_versions row, enqueues render_pdf and returns immediately
 * (pdf_status = queued). Saving a retired HTML or imported document converts
 * it to Typst (template defaults to the closest match of its old template).
 * A legacy `engine: "html"` + HTML template id from old clients is mapped too.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const doc = await findOwnedDocument(supabase, params.id, user.id, typeHint(req));
	if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

	const parsed = await parseJson(req, documentUpdateSchema);
	if (!parsed.success) return parsed.response;
	const body = parsed.data;
	const content = body.content_json;
	if (!content || typeof content !== "object" || Array.isArray(content)) {
		return NextResponse.json({ error: "content_json must be an object" }, { status: 400 });
	}
	if (JSON.stringify(content).length > MAX_CONTENT_BYTES) {
		return NextResponse.json({ error: "Document is too large" }, { status: 413 });
	}

	const template =
		typeof body.template === "string" && body.template
			? resolveTemplateId(doc.type, body.engine === "html" ? `html:${body.template}` : body.template)
			: typstTemplateFor(doc.type, doc.row);
	const t = await getTypstTemplate(template);
	if (!t) return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 });
	if (t.kind !== doc.type) {
		return NextResponse.json({ error: `${t.name} is not a ${doc.type.replace("_", " ")} template` }, { status: 400 });
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
		engine: "typst",
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

	const render = await queueTypstRender({ type: doc.type, documentId: doc.row.id, userId: user.id, templateId: template });

	const fresh = await findOwnedDocument(supabase, doc.row.id, user.id, doc.type);
	return NextResponse.json({
		ok: true,
		version,
		render,
		status: fresh ? toStatus(fresh) : null,
	});
}
