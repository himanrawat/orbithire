import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
	PutObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getR2Client, objectBodyToWebStream } from "@/lib/r2Object";
import { validateImageBuffer } from "@/lib/imageValidation";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
 * GET /api/profile/photo
 * Proxy the authenticated user's profile photo from R2
 * This allows private R2 bucket without signed URLs
 */
export async function GET() {
	const r2Client = getR2Client();
	if (!r2Client || !serverEnv.r2Bucket) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	const supabase = createServerSupabase();

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
		let url: URL;
		try {
			url = new URL(avatarKey);
		} catch {
			return NextResponse.json({ error: "Invalid legacy photo URL." }, { status: 404 });
		}
		const configuredHosts = (process.env.LEGACY_AVATAR_HOSTS || "")
			.split(",")
			.map((host) => host.trim().toLowerCase())
			.filter(Boolean);
		if (url.protocol !== "https:" || !configuredHosts.includes(url.hostname.toLowerCase())) {
			return NextResponse.json({ error: "Legacy photo host is not allowed." }, { status: 404 });
		}
		return NextResponse.redirect(url);
	}

	let result;
	try {
		result = await r2Client.send(
			new GetObjectCommand({ Bucket: serverEnv.r2Bucket, Key: avatarKey })
		);
	} catch (error) {
		console.error("Failed to fetch photo from R2:", error);
		return NextResponse.json(
			{ error: "Failed to fetch photo." },
			{ status: 500 }
		);
	}
	if (!result.Body) return NextResponse.json({ error: "No profile photo found." }, { status: 404 });
	if ((result.ContentLength || 0) > MAX_IMAGE_BYTES) {
		(result.Body as { destroy?: () => void }).destroy?.();
		return NextResponse.json({ error: "Stored image is too large." }, { status: 413 });
	}

	const headers = new Headers({
		"Content-Type": result.ContentType || "image/jpeg",
		"Cache-Control": "private, max-age=3600",
		"X-Content-Type-Options": "nosniff",
	});
	if (result.ContentLength !== undefined) headers.set("Content-Length", String(result.ContentLength));
	if (result.ETag) headers.set("ETag", result.ETag);
	return new NextResponse(objectBodyToWebStream(result.Body), {
		status: 200,
		headers,
	});
}

export async function POST(req: NextRequest) {
	const r2Client = getR2Client();
	if (!r2Client || !serverEnv.r2Bucket) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	const supabase = createServerSupabase();

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

	let contentType = (file.type || "application/octet-stream").toLowerCase();
	if (contentType && !ALLOWED_IMAGE_TYPES.has(contentType)) {
		return NextResponse.json(
			{ error: "Use JPG, PNG, or WEBP images." },
			{ status: 400 }
		);
	}
	try {
		contentType = validateImageBuffer(buffer, contentType).contentType;
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Invalid image." },
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

	// Return proxy URL instead of signed URL - this never expires; the version busts the browser cache
	const proxyUrl = `/api/profile/photo?v=${encodeURIComponent(key.split("/").pop() || key)}`;

	return NextResponse.json({ ok: true, key, url: proxyUrl }, { status: 200 });
}
