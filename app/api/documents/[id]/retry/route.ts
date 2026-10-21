import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { ensureTypstDocument, findOwnedDocument, queueTypstRender, toStatus } from "@/lib/documents";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/documents/[id]/retry?type=resume|cover_letter
 * Re-render the PDF: enqueue render_pdf (returns immediately).
 * Imported PDFs (and retired HTML rows without content) are never re-rendered: 409.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const t = req.nextUrl.searchParams.get("type");
	const hint: DocumentType | null = t === "resume" || t === "cover_letter" ? t : null;
	const doc = await findOwnedDocument(supabase, params.id, user.id, hint);
	if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

	// Don't double-queue an in-flight render, unless it looks stuck (> 2 min).
	const ageMs = Date.now() - new Date(doc.row.updated_at).getTime();
	if ((doc.row.pdf_status === "queued" || doc.row.pdf_status === "rendering") && ageMs < 120_000) {
		return NextResponse.json({ ok: true, status: toStatus(doc), note: "already in progress" });
	}

	const typst = await ensureTypstDocument(doc);
	if ("reason" in typst) {
		return NextResponse.json({ ok: false, error: typst.reason, status: toStatus(doc) }, { status: 409 });
	}
	const result = await queueTypstRender({
		type: doc.type,
		documentId: doc.row.id,
		userId: user.id,
		templateId: typst.template,
	});
	const fresh = await findOwnedDocument(supabase, doc.row.id, user.id, doc.type);
	return NextResponse.json(
		{ ok: result.ok, error: result.error, status: fresh ? toStatus(fresh) : null },
		{ status: result.ok ? 200 : 502 }
	);
}
