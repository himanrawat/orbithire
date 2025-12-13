import { NextRequest, NextResponse } from "next/server";
import {
	TEMPLATE_IDS,
	fetchThumbnail,
	generateAndUploadTemplate,
} from "@/lib/templateThumbnails";
import { isR2Configured } from "@/lib/r2Config";

export const dynamic = "force-dynamic";

/**
 * GET /api/template/thumbnail/[templateId]
 * Returns the thumbnail image for a template (proxied from R2)
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
		// Try to fetch existing thumbnail from R2
		let imageBuffer = await fetchThumbnail(templateId);

		// If not found, generate on-demand
		if (!imageBuffer) {
			// Get base URL from request for internal API calls
			const url = new URL(request.url);
			const baseUrl = `${url.protocol}//${url.host}`;

			const result = await generateAndUploadTemplate(
				templateId,
				false,
				baseUrl
			);

			if (!result.thumbnail) {
				return NextResponse.json(
					{ error: "Failed to generate thumbnail" },
					{ status: 500 }
				);
			}

			// Fetch the newly generated thumbnail
			imageBuffer = await fetchThumbnail(templateId);
		}

		if (!imageBuffer) {
			return NextResponse.json(
				{ error: "Failed to retrieve thumbnail" },
				{ status: 500 }
			);
		}

		// Return the image with proper headers
		// Convert Buffer to Uint8Array for NextResponse compatibility
		return new NextResponse(new Uint8Array(imageBuffer), {
			status: 200,
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=31536000, immutable", // 1 year cache
				"Content-Length": imageBuffer.length.toString(),
			},
		});
	} catch (error) {
		console.error("Thumbnail API error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
