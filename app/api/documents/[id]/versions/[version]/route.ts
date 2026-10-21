import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
	findOwnedDocument,
	hasRenderableContent,
	insertDocumentVersion,
	queueTypstRender,
	toStatus,
	typstTemplateFor,
} from "@/lib/documents";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(req: NextRequest, params: { id: string; version: string }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
	const version = Number(params.version);
	if (!Number.isInteger(version) || version < 1) {
		return { error: NextResponse.json({ error: "Invalid version" }, { status: 400 }) };
	}
	const t = req.nextUrl.searchParams.get("type");
	const hint: DocumentType | null = t === "resume" || t === "cover_letter" ? t : null;
	const doc = await findOwnedDocument(supabase, params.id, user.id, hint);
	if (!doc) return { error: NextResponse.json({ error: "Document not found" }, { status: 404 }) };
	const { data } = await supabase
		.from("document_versions")
		.select("id, version, source, created_at, content_json")
		.eq("user_id", user.id)
		.eq("document_type", doc.type)
		.eq("document_id", doc.row.id)
		.eq("version", version)
		.maybeSingle();
	if (!data) return { error: NextResponse.json({ error: "Version not found" }, { status: 404 }) };
	return { supabase, user, doc, version: data };
}

/** GET /api/documents/[id]/versions/[version]?type=… – one version incl. content_json. */
export async function GET(req: NextRequest, { params }: { params: { id: string; version: string } }) {
	const r = await load(req, params);
	if ("error" in r) return r.error;
	return NextResponse.json(r.version, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/documents/[id]/versions/[version]?type=… – restore.
 * Copies that version's content onto the document as a NEW version (old versions are
 * never changed) and queues a re-render. A retired HTML / imported document is
 * converted to Typst only when the restored version has content to render;
 * otherwise its stored PDF is left alone.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string; version: string } }) {
	const r = await load(req, params);
	if ("error" in r) return r.error;
	const { supabase, user, doc, version } = r;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const content = (version.content_json || {}) as Record<string, any>;

	const update: Record<string, unknown> = { content_json: content, updated_at: new Date().toISOString() };
	let letterText: string | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const target: Record<string, any> = { content_json: content };
	if (doc.type === "cover_letter") {
		const ps: string[] = Array.isArray(content.paragraphs) ? content.paragraphs : [];
		letterText =
			typeof content.content === "string" && !ps.length
				? content.content
				: [content.salutation, ...ps, content.closing, content.signature].filter(Boolean).join("\n\n");
		if (letterText) update.content = letterText;
		target.content = letterText;
	}
	const renderable = hasRenderableContent(doc.type, target);
	const template = typstTemplateFor(doc.type, doc.row);
	if (renderable && doc.row.engine !== "typst") {
		update.engine = "typst";
		update.template = template;
	}
	const { error } = await supabase.from(doc.table).update(update).eq("id", doc.row.id).eq("user_id", user.id);
	if (error) return NextResponse.json({ error: "Could not restore this version" }, { status: 500 });

	const newVersion = await insertDocumentVersion(supabase, {
		userId: user.id,
		type: doc.type,
		documentId: doc.row.id,
		contentJson: content,
	});

	const render: { ok: boolean; error?: string; skipped?: string } =
		renderable || doc.row.engine === "typst"
			? await queueTypstRender({ type: doc.type, documentId: doc.row.id, userId: user.id, templateId: template })
			: { ok: true, skipped: "nothing to render; the stored PDF is kept" };
	const fresh = await findOwnedDocument(supabase, doc.row.id, user.id, doc.type);
	return NextResponse.json({
		ok: true,
		restored_from: version.version,
		version: newVersion,
		render,
		document: fresh?.row ?? null,
		status: fresh ? toStatus(fresh) : null,
	});
}
