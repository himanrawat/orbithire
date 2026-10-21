import { NextRequest, NextResponse } from "next/server";
import { listTypstTemplates } from "@/lib/typstTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/templates?kind=resume|cover_letter
 * The Typst templates (from templates/typst/*\/meta.json).
 */
export async function GET(req: NextRequest) {
	const kind = req.nextUrl.searchParams.get("kind");
	const typst = await listTypstTemplates();
	let templates = typst;
	if (kind === "resume" || kind === "cover_letter") {
		templates = templates.filter((t) => t.kind === kind);
	}
	return NextResponse.json(
		{ templates },
		{ headers: { "Cache-Control": "public, max-age=300" } }
	);
}
