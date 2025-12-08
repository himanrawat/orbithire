import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

function publicUrlForKey(key: string | null) {
	if (!key) return null;
	if (key.startsWith("http")) return key;

	const base = (
		serverEnv.r2PublicBaseUrl ||
		serverEnv.r2Endpoint ||
		""
	).replace(/\/$/, "");
	if (!base || !serverEnv.r2Bucket) return null;
	return `${base}/${serverEnv.r2Bucket}/${key}`;
}

async function signPhoto(key: string | null) {
	if (!key) return null;
	if (key.startsWith("http")) return key;
	// Prefer signing; fall back to public URL only if signing isn't available.
	if (r2Client && serverEnv.r2Bucket) {
		try {
			return await getSignedUrl(
				r2Client,
				new GetObjectCommand({
					Bucket: serverEnv.r2Bucket,
					Key: key,
				}),
				{ expiresIn: 60 * 10 }
			);
		} catch (err) {
			console.error("Failed to sign uploaded photo URL:", err);
		}
	}

	return publicUrlForKey(key);
}

export async function POST(req: NextRequest) {
	if (!r2Client || !serverEnv.r2Bucket) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	const supabase = createServerClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseAnonKey,
		{
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
		}
	);

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
		return NextResponse.json(
			{ error: "Upload is empty." },
			{ status: 400 }
		);
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

	const signedUrl = await signPhoto(key);

	return NextResponse.json(
		{ ok: true, key, url: signedUrl || publicUrlForKey(key) || null },
		{ status: 200 }
	);
}
