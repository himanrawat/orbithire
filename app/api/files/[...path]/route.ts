import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
	getR2Client,
	objectBodyToWebStream,
	safeContentDispositionFilename,
} from "@/lib/r2Object";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/files/[...path]
 * Proxy files from R2 with authentication
 *
 * Path structure: /api/files/{userId}/{type}/{filename}
 * Examples:
 *   /api/files/6beedc31.../resumes/deloitte-123.pdf
 *   /api/files/6beedc31.../cover-letters/google-456.pdf
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: { path: string[] } }
) {
	const r2Client = getR2Client();
	if (!r2Client || !serverEnv.r2Bucket) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	const pathParts = params.path;

	if (!pathParts || pathParts.length < 3) {
		return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
	}

	// Reconstruct the R2 key from path parts
	const r2Key = pathParts.join("/");
	const fileUserId = pathParts[0];

	// Authenticate the user
	const supabase = createServerSupabase();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	}

	// Security: Users can only access their own files
	if (user.id !== fileUserId) {
		return NextResponse.json({ error: "Access denied." }, { status: 403 });
	}

	const range = request.headers.get("range");
	if (range && !/^bytes=\d*-\d*$/.test(range)) {
		return NextResponse.json({ error: "Invalid byte range." }, { status: 416 });
	}

	let result;
	try {
		result = await r2Client.send(
			new GetObjectCommand({
				Bucket: serverEnv.r2Bucket,
				Key: r2Key,
				Range: range || undefined,
			})
		);
	} catch (error) {
		console.error("Failed to fetch from R2:", error);
		return NextResponse.json({ error: "File not found." }, { status: 404 });
	}
	if (!result.Body) return NextResponse.json({ error: "File not found." }, { status: 404 });
	if ((result.ContentLength || 0) > serverEnv.maxProxyBytes) {
		(result.Body as { destroy?: () => void }).destroy?.();
		return NextResponse.json({ error: "File is too large to proxy." }, { status: 413 });
	}

	// Determine content-disposition based on file type
	const filename = safeContentDispositionFilename(pathParts.at(-1) || "file");
	const isInline = request.nextUrl.searchParams.get("view") === "true";
	const disposition = isInline
		? "inline"
		: `attachment; filename="${filename}"`;

	const headers = new Headers({
		"Content-Type": result.ContentType || "application/octet-stream",
			"Content-Disposition": disposition,
		"Cache-Control": "private, max-age=3600",
		"Accept-Ranges": "bytes",
	});
	if (result.ContentLength !== undefined) headers.set("Content-Length", String(result.ContentLength));
	if (result.ContentRange) headers.set("Content-Range", result.ContentRange);
	if (result.ETag) headers.set("ETag", result.ETag);
	if (result.LastModified) headers.set("Last-Modified", result.LastModified.toUTCString());
	return new NextResponse(objectBodyToWebStream(result.Body), {
		status: result.ContentRange ? 206 : 200,
		headers,
	});
}
