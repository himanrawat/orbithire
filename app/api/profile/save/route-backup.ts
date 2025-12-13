import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

type WorkExperience = {
	id?: string;
	company?: string;
	role?: string;
	location?: string;
	start_date?: string;
	end_date?: string | null;
	description?: string;
};

type Education = {
	id?: string;
	institution?: string;
	degree?: string;
	location?: string;
	start_date?: string;
	end_date?: string;
};

type CustomField = { id?: string; label?: string; value?: string };
type CustomEntry = { id?: string; title?: string; value?: string };
type CustomSection = { id?: string; title?: string; entries?: CustomEntry[] };

type ProfilePayload = {
	full_name?: string;
	email?: string;
	phone?: string;
	location?: string;
	bio?: string;
	website?: string;
	linkedin_url?: string;
	github_url?: string;
	avatar_url?: string | null;
	skills?: string[];
	work_experience?: WorkExperience[];
	education?: Education[];
	custom_fields?: CustomField[];
};

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

function parseDataUrl(dataUrl: string) {
	const match = /^data:(.+?);base64,(.*)$/i.exec(dataUrl);
	if (!match) return null;
	const contentType = match[1];
	const buffer = Buffer.from(match[2], "base64");
	return { contentType, buffer };
}

async function uploadPhotoToR2(dataUrl: string, userId: string) {
	if (!r2Client || !serverEnv.r2Bucket) return null;
	const parsed = parseDataUrl(dataUrl);
	if (!parsed) return null;

	const ext =
		(parsed.contentType.includes("jpeg") && "jpg") ||
		(parsed.contentType.includes("png") && "png") ||
		(parsed.contentType.includes("webp") && "webp") ||
		"bin";

	// Store everything for a given user under a single folder.
	const key = `${userId}/${Date.now()}-${randomUUID()}.${ext}`;

	await r2Client.send(
		new PutObjectCommand({
			Bucket: serverEnv.r2Bucket,
			Key: key,
			Body: parsed.buffer,
			ContentType: parsed.contentType,
		})
	);

	return { key };
}

async function signPhotoUrl(key: string | null): Promise<string | null> {
	if (!key || !r2Client || !serverEnv.r2Bucket) return null;
	if (key.startsWith("blob:") || key.startsWith("data:")) return null;
	try {
		return await getSignedUrl(
			r2Client,
			new GetObjectCommand({
				Bucket: serverEnv.r2Bucket,
				Key: key,
			}),
			{ expiresIn: 60 * 10 } // 10 minutes
		);
	} catch (err) {
		console.error("Failed to sign photo URL:", err);
		return null;
	}
}

function normalizeR2Key(value: string | null | undefined) {
	if (!value) return null;
	const trimmed = `${value}`.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("blob:") || trimmed.startsWith("data:"))
		return trimmed;

	const base = (
		serverEnv.r2PublicBaseUrl ||
		serverEnv.r2Endpoint ||
		""
	).replace(/\/$/, "");
	const bucket = serverEnv.r2Bucket || "";

	if (trimmed.startsWith("http") && base) {
		try {
			const parsed = new URL(trimmed);
			const baseUrl = new URL(base);
			if (parsed.host === baseUrl.host) {
				const basePath = baseUrl.pathname.replace(/^\/+/, "");
				const path = parsed.pathname.replace(/^\/+/, "");
				const withoutBase =
					basePath && path.startsWith(`${basePath}/`)
						? path.slice(basePath.length + 1)
						: path;
				const withoutBucket =
					bucket && withoutBase.startsWith(`${bucket}/`)
						? withoutBase.slice(bucket.length + 1)
						: withoutBase;
				return withoutBucket.split("?")[0] || null;
			}
		} catch {
			// Fall through to return the trimmed value.
		}
	}

	if (bucket && trimmed.startsWith(`${bucket}/`)) {
		return trimmed.slice(bucket.length + 1);
	}

	return trimmed;
}

export async function POST(req: NextRequest) {
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

	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return NextResponse.json(
			{ error: "Invalid request body." },
			{ status: 400 }
		);
	}

	const profile: ProfilePayload = body.profile || {};
	const customSections: CustomSection[] = Array.isArray(body.customSections)
		? body.customSections
		: [];

	if (!profile.full_name || typeof profile.full_name !== "string") {
		return NextResponse.json(
			{ error: "Full name is required." },
			{ status: 400 }
		);
	}

	if (!serverEnv.supabaseServiceRoleKey) {
		return NextResponse.json(
			{ error: "Missing SUPABASE_SERVICE_ROLE_KEY on server." },
			{ status: 503 }
		);
	}

	const admin = createClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseServiceRoleKey,
		{
			auth: { autoRefreshToken: false, persistSession: false },
		}
	);

	// Preserve existing photo when the client sends only a blob placeholder
	let existingAvatar: string | null = null;
	try {
		const { data: existing } = await admin
			.from("profiles")
			.select("avatar_url")
			.eq("id", user.id)
			.single();
		existingAvatar = normalizeR2Key(existing?.avatar_url);
	} catch (e) {
		console.warn("Unable to fetch existing profile photo", e);
	}

	const rawImage = profile.avatar_url ?? null;
	const wantsRemoval = profile.avatar_url === null || rawImage === "";

	let photoUrl: string | null = wantsRemoval ? null : existingAvatar;
	const incomingImage = rawImage?.startsWith("blob:") ? null : rawImage;

	if (incomingImage?.startsWith("data:")) {
		try {
			const uploaded = await uploadPhotoToR2(incomingImage, user.id);
			photoUrl = uploaded?.key || existingAvatar;
		} catch (err) {
			console.error("Failed to upload photo to R2:", err);
			photoUrl = incomingImage;
		}
	} else if (incomingImage) {
		const normalized = normalizeR2Key(incomingImage);
		photoUrl = normalized;
	}

	const extendedJson = JSON.stringify({
		work_experience: profile.work_experience || [],
		education: profile.education || [],
		custom_fields: profile.custom_fields || [],
		customSections,
		github_url: profile.github_url || "",
		avatar_url: photoUrl || "",
	});

	const upsertPayload: Record<string, any> = {
		id: user.id,
		email: profile.email?.trim() || null,
		full_name: profile.full_name.trim(),
		headline: profile.bio?.trim() || null,
		phone: profile.phone?.trim() || null,
		location: profile.location?.trim() || null,
		linkedin_url: profile.linkedin_url?.trim() || null,
		portfolio_url: profile.website?.trim() || null,
		experience_summary: profile.bio?.trim() || null,
		education_summary: extendedJson,
		skills: Array.isArray(profile.skills) ? profile.skills : [],
		updated_at: new Date().toISOString(),
	};
	// Update photo only when we have a new one; if a blob placeholder was sent, clear it.
	if (photoUrl !== null) {
		upsertPayload.avatar_url = photoUrl;
	} else if (rawImage?.startsWith("blob:") || wantsRemoval) {
		upsertPayload.avatar_url = null;
	}

	const { data, error } = await admin
		.from("profiles")
		.upsert(upsertPayload)
		.select("id")
		.single();

	if (error) {
		console.error("Profile save failed:", error);
		if ((error as any).code === "42501") {
			return NextResponse.json(
				{
					error:
						"Supabase role is missing permissions on schema public. Ensure service_role (or authenticated) has USAGE on schema public and privileges on table profiles.",
					code: "SUPABASE_SCHEMA_PERMISSION",
				},
				{ status: 500 }
			);
		}
		return NextResponse.json(
			{
				error:
					error.message || error.details || "Unable to save profile right now.",
			},
			{ status: 500 }
		);
	}

	// Sign the photo URL for immediate use by the client
	const signedAvatarUrl = await signPhotoUrl(upsertPayload.avatar_url ?? null);

	return NextResponse.json(
		{ ok: true, saved: true, id: data.id, avatar_url: signedAvatarUrl },
		{ status: 200 }
	);
}
