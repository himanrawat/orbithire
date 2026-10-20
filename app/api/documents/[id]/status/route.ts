import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { DOCUMENT_TABLES, UUID_RE } from "@/lib/documents";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = "id, engine, template, pdf_status, pdf_error, pdf_url, updated_at";

/**
 * GET /api/documents/[id]/status?type=resume|cover_letter
 * Cheap status poll for the PDF badge (owner only, via RLS + user_id filter).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Document not found" }, { status: 404 });

	const hint = req.nextUrl.searchParams.get("type");
	const order: DocumentType[] = hint === "cover_letter" ? ["cover_letter", "resume"] : ["resume", "cover_letter"];
	for (const type of order) {
		const { data } = await supabase
			.from(DOCUMENT_TABLES[type])
			.select(COLUMNS)
			.eq("id", params.id)
			.eq("user_id", user.id)
			.maybeSingle();
		if (data) {
			return NextResponse.json(
				{ type, ...data, engine: data.engine ?? "html", pdf_status: data.pdf_status ?? "none" },
				{ headers: { "Cache-Control": "no-store" } }
			);
		}
	}
	return NextResponse.json({ error: "Document not found" }, { status: 404 });
}
