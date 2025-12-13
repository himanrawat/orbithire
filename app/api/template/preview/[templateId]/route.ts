import { NextRequest, NextResponse } from "next/server";
import {
	TEMPLATE_IDS,
	fetchPreviewHtml,
	generateAndUploadTemplate,
} from "@/lib/templateThumbnails";
import { isR2Configured } from "@/lib/r2Config";

export const dynamic = "force-dynamic";

/**
 * GET /api/template/preview/[templateId]
 * Returns the preview HTML for a template (proxied from R2)
 * Generates and caches to R2 if not already present
 *
 * This proxies through the API so it works with private R2 buckets
 * and doesn't require signed URLs.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: { templateId: string } }
) {
	const { templateId } = params;

	// Validate template ID
	if (!TEMPLATE_IDS.includes(templateId as any)) {
		return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
	}

	// Check if R2 is configured
	if (!isR2Configured()) {
		return NextResponse.json(
			{ error: "R2 storage not configured" },
			{ status: 503 }
		);
	}

	try {
		// Try to fetch existing preview HTML from R2
		let html = await fetchPreviewHtml(templateId);

		// If not found, generate on-demand
		if (!html) {
			// Get base URL from request for internal API calls
			const url = new URL(request.url);
			const baseUrl = `${url.protocol}//${url.host}`;

			const result = await generateAndUploadTemplate(
				templateId,
				false,
				baseUrl
			);

			if (!result.preview) {
				return NextResponse.json(
					{ error: "Failed to generate preview" },
					{ status: 500 }
				);
			}

			// Fetch the newly generated preview
			html = await fetchPreviewHtml(templateId);
		}

		if (!html) {
			return NextResponse.json(
				{ error: "Failed to retrieve preview" },
				{ status: 500 }
			);
		}

		// Return the HTML with proper headers
		return new NextResponse(html, {
			status: 200,
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "public, max-age=31536000, immutable", // 1 year cache
			},
		});
	} catch (error) {
		console.error("Preview API error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
