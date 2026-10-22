import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";
// Reads the session from req.cookies, which does not opt out of Next's fetch cache:
// without this, Supabase reads and upserts were served from .next/cache (stale data, lost saves).
export const fetchCache = "force-no-store";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const abbreviate = (value: any, max = 96) => {
	if (!value) return value;
	const str = `${value}`;
	if (str.length <= max) return str;
	const head = str.slice(0, Math.floor(max / 2));
	const tail = str.slice(-12);
	return `${head}...${tail}`;
};

const supabaseHost = () => {
	try {
		return new URL(serverEnv.supabaseUrl).host;
	} catch {
		return serverEnv.supabaseUrl;
	}
};

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
	resume_email?: string | null;
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
	const keyFromUrl = r2KeyFromUrl(trimmed, base, bucket);
	if (keyFromUrl !== undefined) return keyFromUrl;

	if (bucket && trimmed.startsWith(`${bucket}/`)) {
		return trimmed.slice(bucket.length + 1);
	}

	return trimmed;
}

function r2KeyFromUrl(value: string, base: string, bucket: string) {
	if (!value.startsWith("http") || !base) return undefined;
	try {
		const parsed = new URL(value);
		const baseUrl = new URL(base);
		if (parsed.host !== baseUrl.host) return undefined;

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
	} catch {
		return undefined;
	}
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

async function uploadDataUrl(dataUrl: string, userId: string) {
	if (!r2Client || !serverEnv.r2Bucket) return null;
	const parsed = parseDataUrl(dataUrl);
	if (!parsed) return null;

	if (parsed.buffer.length > MAX_IMAGE_BYTES) {
		throw new Error("Image must be 5MB or smaller.");
	}

	if (parsed.contentType && !ALLOWED_IMAGE_TYPES.has(parsed.contentType)) {
		throw new Error("Use JPG, PNG, or WEBP images.");
	}

	const ext =
		(parsed.contentType.includes("jpeg") && "jpg") ||
		(parsed.contentType.includes("png") && "png") ||
		(parsed.contentType.includes("webp") && "webp") ||
		"bin";

	const key = `${userId}/photos/${Date.now()}-${randomUUID()}.${ext}`;

	await r2Client.send(
		new PutObjectCommand({
			Bucket: serverEnv.r2Bucket,
			Key: key,
			Body: parsed.buffer,
			ContentType: parsed.contentType,
		})
	);

	return key;
}

/**
 * Returns proxy URL for profile photo - never expires since it's just an API route
 * The proxy endpoint fetches from R2 server-side, allowing private buckets
 */
function getProxyPhotoUrl(key: string | null): string | null {
	if (!key) return null;
	if (key.startsWith("http")) return key; // Already a full URL (legacy data)
	// Return the proxy API endpoint - this never expires. Every upload gets a
	// new key, so versioning by it busts the browser cache when the photo changes.
	return `/api/profile/photo?v=${encodeURIComponent(key.split("/").pop() || key)}`;
}

const normalizeString = (value: any) => {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
};

const isDifferent = (a: any, b: any) => JSON.stringify(a) !== JSON.stringify(b);

function createReadOnlySupabase(req: NextRequest) {
	return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
		cookies: {
			getAll: () => req.cookies.getAll(),
			setAll: () => {},
		},
	});
}

function createWritableSupabase() {
	const cookieStore = cookies();
	return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
		cookies: {
			getAll: () => cookieStore.getAll(),
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					cookieStore.set({
						name,
						value,
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						domain: serverEnv.authCookieDomain,
						path: "/",
						...options,
					});
				});
			},
		},
	});
}

function parseExtendedProfile(value: unknown, logParseFailure = false): Record<string, any> {
	if (!value) return {};
	if (typeof value === "object") return value as Record<string, any>;
	if (typeof value !== "string") return {};
	try {
		return JSON.parse(value);
	} catch (error) {
		if (logParseFailure) {
			console.warn("[profile/get] failed to parse extended_profile", error);
		}
		return {};
	}
}

export async function GET(req: NextRequest) {
	const supabase = createReadOnlySupabase(req);

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
			"id, email, resume_email, can_change_email, full_name, phone, location, headline, portfolio_url, linkedin_url, avatar_url, skills, experience_summary, extended_profile"
		)
		.eq("id", user.id)
		.single();

	if (error) {
		console.error("[profile/get] Error fetching profile:", error);
		return NextResponse.json(
			{
				error:
					error.message || error.details || "Unable to load profile right now.",
			},
			{ status: 500 }
		);
	}

	const extended = parseExtendedProfile(data.extended_profile, true);

	const extendedAvatar =
		extended && typeof extended === "object" ? extended.avatar_url : undefined;
	const useAvatar =
		extendedAvatar === null ? null : data.avatar_url ?? extendedAvatar ?? null;
	const photoKey = useAvatar === null ? null : normalizeR2Key(useAvatar);
	const proxyPhotoUrl = getProxyPhotoUrl(photoKey);

	const {
		avatar_url: _avatarUrl,
		extended_profile: _ext,
		...profileWithoutPhoto
	} = data;
	const resolvedEmail =
		normalizeString(profileWithoutPhoto.email) ?? user.email ?? null;

	return NextResponse.json(
		{
			profile: {
				...profileWithoutPhoto,
				email: resolvedEmail,
				resume_email: data.resume_email || null,
				can_change_email: data.can_change_email ?? false,
				avatar_url: proxyPhotoUrl,
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

function buildProfileState(existing: any, userEmail: string | undefined) {
	const existingAvatar = normalizeR2Key(existing?.avatar_url);
	const existingExtended = parseExtendedProfile(existing?.extended_profile);
	const lockedEmail =
		normalizeString(existing?.email) ?? normalizeString(userEmail) ?? null;
	const baseExtended = {
		work_experience: existingExtended.work_experience || [],
		education: existingExtended.education || [],
		custom_fields: existingExtended.custom_fields || [],
		customSections: existingExtended.customSections || [],
		github_url: existingExtended.github_url || "",
		avatar_url: existingExtended.avatar_url ?? existingAvatar ?? null,
	};
	const baseProfile = {
		email: lockedEmail,
		resume_email: normalizeString(existing?.resume_email) ?? null,
		full_name: normalizeString(existing?.full_name),
		phone: normalizeString(existing?.phone),
		location: normalizeString(existing?.location),
		website: normalizeString(existing?.portfolio_url),
		linkedin_url: normalizeString(existing?.linkedin_url),
		bio: normalizeString(
			existing?.experience_summary ?? existing?.headline ?? null
		),
		skills: Array.isArray(existing?.skills) ? existing.skills : [],
	};
	return { existingAvatar, lockedEmail, baseExtended, baseProfile };
}

function applyProfileInput(
	target: Record<string, any>,
	profile: ProfilePayload,
	canChangeEmail: boolean
) {
	const fields: Array<[keyof ProfilePayload, string]> = [
		["full_name", "full_name"],
		["phone", "phone"],
		["location", "location"],
		["website", "website"],
		["linkedin_url", "linkedin_url"],
		["bio", "bio"],
	];
	fields.forEach(([inputField, targetField]) => {
		const value = normalizeString(profile[inputField]);
		if (value !== undefined) target[targetField] = value;
	});
	if (Array.isArray(profile.skills)) target.skills = profile.skills;

	const resumeEmail = normalizeString(profile.resume_email);
	if (canChangeEmail && resumeEmail !== undefined) {
		target.resume_email = resumeEmail || null;
	}
}

function applyExtendedInput(
	target: Record<string, any>,
	profile: ProfilePayload,
	customSections: CustomSection[] | undefined
) {
	if (profile.work_experience !== undefined) {
		target.work_experience = profile.work_experience || [];
	}
	if (profile.education !== undefined) target.education = profile.education || [];
	if (profile.custom_fields !== undefined) {
		target.custom_fields = profile.custom_fields || [];
	}
	if (profile.github_url !== undefined) target.github_url = profile.github_url || "";
	if (customSections !== undefined) target.customSections = customSections;
}

async function resolveAvatarUpdate(
	avatarValue: string | null | undefined,
	existingAvatar: string | null,
	userId: string
) {
	if (avatarValue === undefined) {
		return { avatarKey: existingAvatar, avatarChanged: false };
	}
	if (avatarValue === null || avatarValue === "") {
		return { avatarKey: null, avatarChanged: true };
	}
	if (typeof avatarValue !== "string") {
		return { avatarKey: existingAvatar, avatarChanged: false };
	}

	const candidate = avatarValue.trim();
	if (candidate.startsWith("data:")) {
		try {
			const uploaded = await uploadDataUrl(candidate, userId);
			return uploaded
				? { avatarKey: uploaded, avatarChanged: true }
				: { avatarKey: existingAvatar, avatarChanged: false };
		} catch (error) {
			console.error("Failed to upload photo from data URL:", error);
			return { avatarKey: existingAvatar, avatarChanged: false };
		}
	}
	if (candidate.startsWith("blob:") || candidate.startsWith("/api/profile/photo")) {
		return { avatarKey: existingAvatar, avatarChanged: false };
	}

	const avatarKey = normalizeR2Key(candidate);
	return { avatarKey, avatarChanged: avatarKey !== existingAvatar };
}

function buildUpdatePayload({
	userId,
	finalEmail,
	finalFullName,
	nextProfile,
	baseProfile,
	nextExtended,
	baseExtended,
	profile,
	avatarKey,
	avatarChanged,
}: Record<string, any>) {
	const updatePayload: Record<string, any> = {
		id: userId,
		email: finalEmail,
		full_name: finalFullName,
		updated_at: new Date().toISOString(),
	};
	const mark = (column: string, value: any, baseline: any) => {
		if (value !== undefined && isDifferent(value, baseline)) {
			updatePayload[column] = value;
		}
	};

	mark("phone", nextProfile.phone ?? null, baseProfile.phone ?? null);
	mark("location", nextProfile.location ?? null, baseProfile.location ?? null);
	mark("portfolio_url", nextProfile.website ?? null, baseProfile.website ?? null);
	mark("linkedin_url", nextProfile.linkedin_url ?? null, baseProfile.linkedin_url ?? null);
	if (profile.bio !== undefined) {
		mark("headline", nextProfile.bio ?? null, baseProfile.bio ?? null);
		mark("experience_summary", nextProfile.bio ?? null, baseProfile.bio ?? null);
	}
	if (profile.skills !== undefined) {
		mark("skills", nextProfile.skills || [], baseProfile.skills || []);
	}
	if (avatarChanged) updatePayload.avatar_url = avatarKey;
	if (isDifferent(nextExtended, baseExtended) || avatarChanged) {
		updatePayload.extended_profile = JSON.stringify(nextExtended);
	}
	return updatePayload;
}

async function saveProfile(admin: any, updatePayload: Record<string, any>) {
	const { data, error } = await admin
		.from("profiles")
		.upsert(updatePayload)
		.select("id, avatar_url")
		.single();

	if (!error) {
		return NextResponse.json(
			{
				ok: true,
				saved: true,
				id: data.id,
				avatar_url: getProxyPhotoUrl(data.avatar_url),
			},
			{ status: 200 }
		);
	}

	console.error("Profile save failed:", error);
	if (error.code === "42501") {
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
		{ error: error.message || error.details || "Unable to save profile right now." },
		{ status: 500 }
	);
}

export async function PATCH(req: NextRequest) {
	const supabase = createWritableSupabase();

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
	const customSectionsInput: CustomSection[] | undefined = Array.isArray(
		body.customSections
	)
		? body.customSections
		: undefined;

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

	const { data: existing } = await admin
		.from("profiles")
		.select(
			"id, email, resume_email, can_change_email, full_name, phone, location, headline, experience_summary, portfolio_url, linkedin_url, avatar_url, skills, extended_profile"
		)
		.eq("id", user.id)
		.maybeSingle();

	const { existingAvatar, lockedEmail, baseExtended, baseProfile } =
		buildProfileState(existing, user.email);
	const canChangeEmail = existing?.can_change_email ?? false;

	const nextExtended = { ...baseExtended };
	const nextProfile = { ...baseProfile };

	const email = normalizeString(profile.email);
	if (lockedEmail && email && email !== lockedEmail) {
		return NextResponse.json(
			{ error: "Email cannot be changed after registration." },
			{ status: 400 }
		);
	}
	if (!lockedEmail && email !== undefined) {
		nextProfile.email = email;
	}
	applyProfileInput(nextProfile, profile, canChangeEmail);
	applyExtendedInput(nextExtended, profile, customSectionsInput);

	if (
		(!r2Client || !serverEnv.r2Bucket) &&
		(profile.avatar_url || "").toString().startsWith("data:")
	) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	const { avatarKey, avatarChanged } = await resolveAvatarUpdate(
		profile.avatar_url,
		existingAvatar,
		user.id
	);

	nextExtended.avatar_url = avatarKey ?? null;

	const finalFullName =
		nextProfile.full_name ??
		baseProfile.full_name ??
		(user as any)?.user_metadata?.full_name ??
		user.email ??
		null;
	if (!finalFullName) {
		return NextResponse.json(
			{ error: "Full name is required." },
			{ status: 400 }
		);
	}
	const finalEmail =
		nextProfile.email ?? lockedEmail ?? normalizeString(user.email) ?? null;
	if (!finalEmail) {
		return NextResponse.json({ error: "Email is required." }, { status: 400 });
	}
	// Ensure we carry forward resolved email/full_name for updates.
	nextProfile.email = finalEmail;
	nextProfile.full_name = finalFullName;

	const updatePayload = buildUpdatePayload({
		userId: user.id,
		finalEmail,
		finalFullName,
		nextProfile,
		baseProfile,
		nextExtended,
		baseExtended,
		profile,
		avatarKey,
		avatarChanged,
	});
	return saveProfile(admin, updatePayload);
}

export const POST = PATCH;
