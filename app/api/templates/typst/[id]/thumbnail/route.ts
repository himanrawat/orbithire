import { NextRequest, NextResponse } from "next/server";
import { readTypstThumbnail } from "@/lib/typstTemplates";

export const runtime = "nodejs";

/** GET /api/templates/typst/[id]/thumbnail – the template's bundled thumbnail.png */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
	const png = await readTypstThumbnail(params.id);
	if (!png) return NextResponse.json({ error: "Template not found" }, { status: 404 });
	return new NextResponse(new Uint8Array(png), {
		status: 200,
		headers: {
			"Content-Type": "image/png",
			"Content-Length": String(png.length),
			"Cache-Control": "public, max-age=86400",
		},
	});
}
