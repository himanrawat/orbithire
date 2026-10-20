import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { DOCUMENT_TABLES, queueTypstRender, renderLegacyHtmlPdf } from "@/lib/documents";
import type { DocumentType } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Renders that sit in queued/rendering longer than this are treated as stuck. */
const STUCK_MS = 10 * 60 * 1000;
/** Legacy HTML renders run inline (Puppeteer), so retry-all handles only a few per call. */
const MAX_INLINE_HTML = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

async function listFailed(supabase: ReturnType<typeof createServerSupabase>, userId: string) {
	const stuckBefore = new Date(Date.now() - STUCK_MS).toISOString();
	const out: (Row & { type: DocumentType; stuck: boolean })[] = [];
	for (const [type, table] of Object.entries(DOCUMENT_TABLES) as [DocumentType, string][]) {
		const columns =
			"id, title, engine, template, pdf_status, pdf_error, updated_at, company_id, content_json, companies(name)" +
			(type === "cover_letter" ? ", content" : "");
		const { data, error } = await supabase
			.from(table)
			.select(columns)
			.eq("user_id", userId)
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
				engine: r.engine ?? "html",
				pdf_status: r.pdf_status,
				pdf_error: r.stuck ? "Render did not finish (stuck)" : r.pdf_error,
				updated_at: r.updated_at,
			})),
		},
		{ headers: { "Cache-Control": "no-store" } }
	);
}

/**
 * POST /api/documents/failed – retry all. Typst documents are re-queued (instant);
 * legacy HTML documents are re-rendered inline, at most MAX_INLINE_HTML per call.
 */
export async function POST() {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const rows = await listFailed(supabase, user.id);
	let queued = 0;
	let rendered = 0;
	let failed = 0;
	let deferred = 0;
	let inline = 0;
	for (const r of rows) {
		if ((r.engine ?? "html") === "typst") {
			const res = await queueTypstRender({ type: r.type, documentId: r.id, userId: user.id });
			if (res.ok) queued++;
			else failed++;
			continue;
		}
		if (inline >= MAX_INLINE_HTML) {
			deferred++;
			continue;
		}
		inline++;
		const res = await renderLegacyHtmlPdf({
			type: r.type,
			documentId: r.id,
			userId: user.id,
			companyName: r.companies?.name || r.title || "document",
			templateId: r.template,
			resumeJson: r.content_json,
			coverLetterText: r.content,
			candidateName: r.content_json?.basics?.name,
		});
		if (res.ok) rendered++;
		else failed++;
	}
	return NextResponse.json({ total: rows.length, queued, rendered, failed, deferred });
}
