import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { findOwnedDocument } from "@/lib/documents";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/documents/[id]/versions?type=resume|cover_letter
 * Version history (newest first): version, source (portal/mcp/import), created_at.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const t = req.nextUrl.searchParams.get("type");
	const hint: DocumentType | null = t === "resume" || t === "cover_letter" ? t : null;
	const doc = await findOwnedDocument(supabase, params.id, user.id, hint);
	if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

	const { data, error } = await supabase
		.from("document_versions")
		.select("id, version, source, created_at")
		.eq("user_id", user.id)
		.eq("document_type", doc.type)
		.eq("document_id", doc.row.id)
		.order("version", { ascending: false })
		.limit(200);
	if (error) return NextResponse.json({ error: "Could not load versions" }, { status: 500 });
	return NextResponse.json({ type: doc.type, versions: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
