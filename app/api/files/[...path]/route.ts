import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Initialize R2 client
const r2Client =
	serverEnv.r2Endpoint &&
	serverEnv.r2Bucket &&
	serverEnv.r2AccessKeyId &&
	serverEnv.r2SecretAccessKey
		? new S3Client({
				region: "auto",
				endpoint: serverEnv.r2Endpoint,
				credentials: {
					accessKeyId: serverEnv.r2AccessKeyId,
					secretAccessKey: serverEnv.r2SecretAccessKey,
				},
		  })
		: null;

/**
 * Create Supabase client for authentication
 */
function createSupabaseClient() {
	return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
		cookies: {
			get(name: string) {
				return cookies().get(name)?.value;
			},
			set(name: string, value: string, options: any) {
				cookies().set({
					name,
					value,
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					domain: serverEnv.authCookieDomain,
					path: "/",
					...options,
				});
			},
			remove(name: string, options: any) {
				cookies().set({
					name,
					value: "",
					expires: new Date(0),
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					domain: serverEnv.authCookieDomain,
					path: "/",
					...options,
				});
			},
		},
	});
}

/**
 * Fetch file from R2
 */
async function fetchFromR2(
	key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
	if (!r2Client || !serverEnv.r2Bucket) return null;

	try {
		const response = await r2Client.send(
			new GetObjectCommand({
				Bucket: serverEnv.r2Bucket,
				Key: key,
			})
		);

		if (!response.Body) return null;

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
		}

		return {
			buffer: Buffer.concat(chunks),
			contentType: response.ContentType || "application/octet-stream",
		};
	} catch (err) {
		console.error("Failed to fetch from R2:", err);
		return null;
	}
}

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
	const supabase = createSupabaseClient();
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

	// Fetch the file from R2
	const result = await fetchFromR2(r2Key);

	if (!result) {
		return NextResponse.json({ error: "File not found." }, { status: 404 });
	}

	// Determine content-disposition based on file type
	const filename = pathParts.at(-1) || "file";
	const isInline = request.nextUrl.searchParams.get("view") === "true";
	const disposition = isInline
		? "inline"
		: `attachment; filename="${filename}"`;

	// Return the file with proper headers
	return new NextResponse(new Uint8Array(result.buffer), {
		status: 200,
		headers: {
			"Content-Type": result.contentType,
			"Content-Disposition": disposition,
			"Content-Length": result.buffer.length.toString(),
			"Cache-Control": "private, max-age=3600", // 1 hour cache
		},
	});
}
