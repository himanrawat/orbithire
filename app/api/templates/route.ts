import { NextRequest, NextResponse } from "next/server";
import { listTypstTemplates } from "@/lib/typstTemplates";
import { HTML_TEMPLATES } from "@/lib/templateCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/templates?kind=resume|cover_letter
 * Typst templates (from templates/typst/*\/meta.json) followed by the legacy
 * HTML templates ("Classic (HTML)").
 */
export async function GET(req: NextRequest) {
	const kind = req.nextUrl.searchParams.get("kind");
	const typst = await listTypstTemplates();
	let templates = [...typst, ...HTML_TEMPLATES];
	if (kind === "resume" || kind === "cover_letter") {
		templates = templates.filter((t) => t.kind === kind);
	}
	return NextResponse.json(
		{ templates },
		{ headers: { "Cache-Control": "public, max-age=300" } }
	);
}
