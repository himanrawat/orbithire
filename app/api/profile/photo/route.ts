import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function resolveExtension(file: Blob & { name?: string }) {
	const fromType = (file.type || "").toLowerCase();
	if (fromType.includes("jpeg") || fromType.includes("jpg")) return "jpg";
	if (fromType.includes("png")) return "png";
	if (fromType.includes("webp")) return "webp";

	const lowerName = `${(file as any).name || ""}`.toLowerCase();
	if (lowerName.endsWith(".jpeg") || lowerName.endsWith(".jpg")) return "jpg";
	if (lowerName.endsWith(".png")) return "png";
	if (lowerName.endsWith(".webp")) return "webp";
	return "bin";
}

/**
 * Fetch image from R2 and return as Buffer
 */
async function fetchPhotoFromR2(
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
			contentType: response.ContentType || "image/jpeg",
		};
	} catch (err) {
		console.error("Failed to fetch photo from R2:", err);
		return null;
	}
}

/**
 * Create Supabase client for server-side operations
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
 * GET /api/profile/photo
 * Proxy the authenticated user's profile photo from R2
 * This allows private R2 bucket without signed URLs
 */
export async function GET() {
	if (!r2Client || !serverEnv.r2Bucket) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	const supabase = createSupabaseClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	}

	// Get the user's avatar R2 key from their profile
	// The key is stored in avatar_url column (not avatar_key)
	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.select("avatar_url")
		.eq("id", user.id)
		.single();

	if (profileError || !profile?.avatar_url) {
		return NextResponse.json(
			{ error: "No profile photo found." },
			{ status: 404 }
		);
	}

	// Skip if it's a URL (legacy data) - can't proxy external URLs
	const avatarKey = profile.avatar_url;
	if (avatarKey.startsWith("http")) {
		// Redirect to the external URL for legacy data
		return NextResponse.redirect(avatarKey);
	}

	// Fetch the image from R2
	const result = await fetchPhotoFromR2(avatarKey);

	if (!result) {
		return NextResponse.json(
			{ error: "Failed to fetch photo." },
			{ status: 500 }
		);
	}

	// Return the image with proper headers
	// Convert Buffer to Uint8Array for NextResponse compatibility
	return new NextResponse(new Uint8Array(result.buffer), {
		status: 200,
		headers: {
			"Content-Type": result.contentType,
			"Cache-Control": "private, max-age=3600", // Cache for 1 hour (private since user-specific)
		},
	});
}

export async function POST(req: NextRequest) {
	if (!r2Client || !serverEnv.r2Bucket) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	const supabase = createSupabaseClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	}

	const formData = await req.formData().catch(() => null);
	if (!formData) {
		return NextResponse.json(
			{ error: "Invalid upload payload." },
			{ status: 400 }
		);
	}

	const file = formData.get("file");
	if (!(file instanceof Blob)) {
		return NextResponse.json(
			{ error: "Upload requires a file." },
			{ status: 400 }
		);
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	if (!buffer.length) {
		return NextResponse.json({ error: "Upload is empty." }, { status: 400 });
	}

	if (buffer.length > MAX_IMAGE_BYTES) {
		return NextResponse.json(
			{ error: "Image must be 5MB or smaller." },
			{ status: 400 }
		);
	}

	const contentType = (file.type || "application/octet-stream").toLowerCase();
	if (contentType && !ALLOWED_IMAGE_TYPES.has(contentType)) {
		return NextResponse.json(
			{ error: "Use JPG, PNG, or WEBP images." },
			{ status: 400 }
		);
	}

	const ext = resolveExtension(file);
	const key = `${user.id}/photos/${Date.now()}-${randomUUID()}.${ext}`;

	try {
		await r2Client.send(
			new PutObjectCommand({
				Bucket: serverEnv.r2Bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType || "application/octet-stream",
			})
		);
	} catch (err) {
		console.error("Failed to upload photo to R2:", err);
		return NextResponse.json(
			{ error: "Unable to upload photo right now." },
			{ status: 500 }
		);
	}

	// Save the R2 key to the profile immediately so the proxy GET works
	const { error: updateError } = await supabase
		.from("profiles")
		.update({ avatar_url: key, updated_at: new Date().toISOString() })
		.eq("id", user.id);

	if (updateError) {
		console.error("Failed to update profile with avatar_url:", updateError);
		// Don't fail - the upload succeeded, user can save profile manually
	}

	// Return proxy URL instead of signed URL - this never expires
	const proxyUrl = "/api/profile/photo";

	return NextResponse.json({ ok: true, key, url: proxyUrl }, { status: 200 });
}
