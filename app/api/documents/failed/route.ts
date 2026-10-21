import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { DOCUMENT_TABLES, ensureTypstDocument, queueTypstRender } from "@/lib/documents";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renders that sit in queued/rendering longer than this are treated as stuck. */
const STUCK_MS = 10 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

async function listFailed(supabase: ReturnType<typeof createServerSupabase>, userId: string) {
	const stuckBefore = new Date(Date.now() - STUCK_MS).toISOString();
	const out: (Row & { type: DocumentType; stuck: boolean })[] = [];
	for (const [type, table] of Object.entries(DOCUMENT_TABLES) as [DocumentType, string][]) {
		const columns =
			"id, user_id, title, engine, source, template, pdf_status, pdf_error, updated_at, company_id, content_json, companies(name)" +
			(type === "cover_letter" ? ", content" : "");
		const { data, error } = await supabase
			.from(table)
			.select(columns)
			.eq("user_id", userId)
			.neq("source", "import") // imported PDFs are never re-rendered
			.or(`pdf_status.eq.failed,and(pdf_status.in.(queued,rendering),updated_at.lt.${stuckBefore})`)
			.order("updated_at", { ascending: false })
			.limit(50);
		if (error) console.error(`[documents/failed] ${table}:`, error.message);
		for (const r of (data || []) as Row[]) out.push({ ...r, type, stuck: r.pdf_status !== "failed" });
	}
	return out;
}

/** GET /api/documents/failed – the user's documents whose PDF failed (or is stuck). */
export async function GET() {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const rows = await listFailed(supabase, user.id);
	return NextResponse.json(
		{
			documents: rows.map((r) => ({
				id: r.id,
				type: r.type,
				title: r.title,
				company: r.companies?.name ?? null,
				company_id: r.company_id,
				engine: r.engine ?? "typst",
				pdf_status: r.pdf_status,
				pdf_error: r.stuck ? "Render did not finish (stuck)" : r.pdf_error,
				updated_at: r.updated_at,
			})),
		},
		{ headers: { "Cache-Control": "no-store" } }
	);
}

/**
 * POST /api/documents/failed – retry all: re-queue every failed/stuck render.
 * Rows that cannot be rendered (retired HTML without content) are skipped.
 */
export async function POST() {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const rows = await listFailed(supabase, user.id);
	let queued = 0;
	let failed = 0;
	let skipped = 0;
	for (const r of rows) {
		const typst = await ensureTypstDocument({ type: r.type, table: DOCUMENT_TABLES[r.type], row: r });
		if ("reason" in typst) {
			skipped++;
			continue;
		}
		const res = await queueTypstRender({ type: r.type, documentId: r.id, userId: user.id, templateId: typst.template });
		if (res.ok) queued++;
		else failed++;
	}
	return NextResponse.json({ total: rows.length, queued, failed, skipped });
}
