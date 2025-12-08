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

async function signPhotoUrl(keyOrUrl: string | null | undefined) {
	if (!keyOrUrl) return null;
	// Ignore local blob URLs that were never uploaded
	if (keyOrUrl.startsWith("blob:")) return null;
	if (!r2Client || !serverEnv.r2Bucket) return keyOrUrl;

	const base =
		(serverEnv.r2PublicBaseUrl || serverEnv.r2Endpoint || "").replace(
			/\/$/,
			""
		);
	const key = keyOrUrl.startsWith("http")
		? keyOrUrl.replace(`${base}/${serverEnv.r2Bucket}/`, "")
		: keyOrUrl;

	// Bail if the key still contains a blob placeholder after stripping
	if (decodeURIComponent(key).includes("blob:")) return null;

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

	// Ignore blob placeholders from older saves
	const cleanExtendedAvatar =
		extended.avatar_url && !`${extended.avatar_url}`.startsWith("blob:")
			? extended.avatar_url
			: null;

	const signedPhoto = await signPhotoUrl(data.avatar_url || cleanExtendedAvatar);
	const resolvedAvatar =
		signedPhoto || data.avatar_url || cleanExtendedAvatar || null;
	const { avatar_url: _avatarUrl, ...profileWithoutPhoto } = data;

	return NextResponse.json(
		{
			profile: {
				...profileWithoutPhoto,
				avatar_url: resolvedAvatar,
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
