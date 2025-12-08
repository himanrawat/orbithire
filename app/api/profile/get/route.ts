import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

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

function normalizeR2Key(value: string | null | undefined) {
	if (!value) return null;
	const trimmed = `${value}`.trim();
	if (!trimmed) return null;
	if (trimmed.startsWith("blob:")) return null;

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

async function signPhotoUrl(key: string | null) {
	if (!key) return null;
	if (key.startsWith("http")) return key;
	if (!r2Client || !serverEnv.r2Bucket) return publicUrlForKey(key);

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
		console.error("Failed to sign photo URL:", err);
		return publicUrlForKey(key);
	}
}

export async function GET(req: NextRequest) {
	const supabase = createServerClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseAnonKey,
		{
			cookies: {
				get(name: string) {
					return req.cookies.get(name)?.value;
				},
				set() {},
				remove() {},
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

	const { data, error } = await admin
		.from("profiles")
		.select(
			"id, email, full_name, phone, location, headline, portfolio_url, linkedin_url, avatar_url, skills, experience_summary, education_summary"
		)
		.eq("id", user.id)
		.single();

	if (error) {
		return NextResponse.json(
			{
				error:
					error.message ||
					error.details ||
					"Unable to load profile right now.",
			},
			{ status: 500 }
		);
	}

	let extended: any = {};
	if (data.education_summary) {
		if (typeof data.education_summary === "string") {
			try {
				extended = JSON.parse(data.education_summary);
			} catch {
				extended = {};
			}
		} else if (typeof data.education_summary === "object") {
			extended = data.education_summary;
		}
	}

	const photoKey =
		data.avatar_url === null ? null : normalizeR2Key(data.avatar_url);
	const signedPhoto = await signPhotoUrl(photoKey);
	const { avatar_url: _avatarUrl, education_summary: _ext, ...profileWithoutPhoto } =
		data;

	return NextResponse.json(
		{
			profile: {
				...profileWithoutPhoto,
				avatar_url: signedPhoto,
				github_url: extended.github_url || null,
				work_experience: extended.work_experience || [],
				education: extended.education || [],
				custom_fields: extended.custom_fields || [],
				customSections: extended.customSections || [],
			},
		},
		{ status: 200 }
	);
}
