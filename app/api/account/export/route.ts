import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { collectAccountExport } from "@/lib/account/server";
import {
	exportFilename,
	parseExportFormat,
	renderExportSummaryHtml,
	type AccountExport,
	type ExportFormat,
} from "@/lib/account/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function exportResponse(data: AccountExport, format: ExportFormat) {
	const filename = exportFilename(format, new Date());
	if (format === "html") {
		return new NextResponse(renderExportSummaryHtml(data), {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Content-Disposition": `inline; filename="${filename}"`,
				"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
				"Cache-Control": "no-store",
			},
		});
	}
	return new NextResponse(JSON.stringify(data, null, 2), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Cache-Control": "no-store",
		},
	});
}

/** GET /api/account/export?format=json|html — the signed-in user's data. */
export async function GET(req: NextRequest) {
	const format = parseExportFormat(req.nextUrl.searchParams.get("format"));
	if (!format) {
		return NextResponse.json({ error: "format must be json or html" }, { status: 400 });
	}

	const supabase = createServerSupabase();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	}

	const limited = await enforceRateLimit(req, {
		scope: "account.export",
		limit: 10,
		windowSeconds: 60 * 60,
		identifier: user.id,
	});
	if (limited) return limited;

	try {
		const data = await collectAccountExport(supabase, user);
		return exportResponse(data, format);
	} catch (error) {
		console.error("[account/export] failed:", error);
		return NextResponse.json({ error: "We couldn't build your export. Please try again." }, { status: 500 });
	}
}
