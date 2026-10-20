import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { DOCUMENT_TABLES, UUID_RE } from "@/lib/documents";
import { ACCENT_RE, TYPST_ID_RE } from "@/lib/templateCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 4 * 1024 * 1024; // worker limit is 5 MB

function workerUrl(): string {
	return (process.env.WORKER_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
}

/**
 * POST /api/documents/[id]/preview
 * Body: { template_id, data, accent?, paper?, format?: "png"|"svg", width? }
 *
 * Live editor preview with the current (unsaved) form data. Proxies to the
 * worker's internal POST /preview and returns page 1 as PNG (or SVG).
 * `id` is a resume / cover letter id owned by the caller, or "new" for a
 * document that has not been saved yet (e.g. the Generate flow).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	if (params.id !== "new") {
		if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Document not found" }, { status: 404 });
		let owned = false;
		for (const table of Object.values(DOCUMENT_TABLES)) {
			const { data } = await supabase.from(table).select("id").eq("id", params.id).eq("user_id", user.id).maybeSingle();
			if (data) {
				owned = true;
				break;
			}
		}
		if (!owned) return NextResponse.json({ error: "Document not found" }, { status: 404 });
	}

	const raw = await req.text();
	if (raw.length > MAX_BODY) return NextResponse.json({ error: "Body too large" }, { status: 413 });
	let body: Record<string, unknown>;
	try {
		body = JSON.parse(raw);
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const templateId = body.template_id;
	if (typeof templateId !== "string" || !TYPST_ID_RE.test(templateId)) {
		return NextResponse.json({ error: "template_id is required" }, { status: 400 });
	}
	if (!body.data || typeof body.data !== "object") {
		return NextResponse.json({ error: "data must be an object" }, { status: 400 });
	}
	const payload: Record<string, unknown> = { template_id: templateId, data: body.data };
	if (typeof body.accent === "string" && ACCENT_RE.test(body.accent)) payload.accent = body.accent;
	if (body.paper === "a4" || body.paper === "letter") payload.paper = body.paper;
	if (body.format === "svg") payload.format = "svg";
	if (typeof body.width === "number") payload.width = body.width;

	let res: Response;
	try {
		res = await fetch(`${workerUrl()}/preview`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(10_000),
			cache: "no-store",
		});
	} catch (err) {
		console.error("[preview] worker unreachable:", err);
		return NextResponse.json({ error: "Preview service is not available" }, { status: 503 });
	}
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: `Preview failed (${res.status})` }));
		return NextResponse.json(err, { status: res.status === 422 ? 422 : res.status >= 500 ? 502 : 400 });
	}
	const buf = new Uint8Array(await res.arrayBuffer());
	const headers: Record<string, string> = {
		"Content-Type": res.headers.get("content-type") || "image/png",
		"Cache-Control": "no-store",
	};
	for (const h of ["x-page-count", "x-render-ms", "x-template-id"]) {
		const v = res.headers.get(h);
		if (v) headers[h] = v;
	}
	return new NextResponse(buf, { status: 200, headers });
}
