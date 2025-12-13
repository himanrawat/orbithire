import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const hasExplicitPublicPhotoBase = Boolean(process.env.R2_PUBLIC_BASE_URL);

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

async function signPhotoUrl(key: string | null) {
	if (!key) return null;
	if (key.startsWith("http")) return key;
	const publicUrl = publicUrlForKey(key);
	// Prefer a stable, non-expiring URL when the bucket is public or a base URL is configured.
	if (publicUrl) {
		return publicUrl;
	}
	// Prefer signing when we can; only fall back to public URL if signing isn't possible.
	if (r2Client && serverEnv.r2Bucket) {
		try {
			return await getSignedUrl(
				r2Client,
				new GetObjectCommand({
					Bucket: serverEnv.r2Bucket,
					Key: key,
				}),
				{ expiresIn: PHOTO_URL_TTL_SECONDS }
			);
		} catch (err) {
			console.error("Failed to sign photo URL:", err);
		}
	}

	return publicUrl;
}

const normalizeString = (value: any) => {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
};

const isDifferent = (a: any, b: any) => JSON.stringify(a) !== JSON.stringify(b);

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
	console.log("[profile/get] user:", user.id);
	console.log("[profile/get] supabase host:", supabaseHost());

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
			"id, email, full_name, phone, location, headline, portfolio_url, linkedin_url, avatar_url, skills, experience_summary, extended_profile"
		)
		.eq("id", user.id)
		.single();

	if (error) {
		return NextResponse.json(
			{
				error:
					error.message || error.details || "Unable to load profile right now.",
			},
			{ status: 500 }
		);
	}

	let extended: any = {};
	console.log(
		"[profile/get] raw extended_profile:",
		abbreviate(
			typeof data.extended_profile === "string"
				? data.extended_profile
				: JSON.stringify(data.extended_profile || "")
		)
	);
	if (data.extended_profile) {
		if (typeof data.extended_profile === "string") {
			try {
				extended = JSON.parse(data.extended_profile);
			} catch (err) {
				console.warn("[profile/get] failed to parse extended_profile", err);
				extended = {};
			}
		} else if (typeof data.extended_profile === "object") {
			extended = data.extended_profile;
		}
	}

	const extendedAvatar =
		extended && typeof extended === "object" ? extended.avatar_url : undefined;
	const useAvatar =
		extendedAvatar === null ? null : data.avatar_url ?? extendedAvatar ?? null;
	const photoKey = useAvatar === null ? null : normalizeR2Key(useAvatar);
	const signedPhoto = await signPhotoUrl(photoKey);
	console.log("[profile/get] avatar column:", abbreviate(data.avatar_url));
	console.log("[profile/get] extended avatar:", abbreviate(extendedAvatar));
	console.log("[profile/get] chosen avatar:", abbreviate(useAvatar));
	console.log("[profile/get] normalized key:", abbreviate(photoKey));
	console.log("[profile/get] signed avatar:", abbreviate(signedPhoto));

	const {
		avatar_url: _avatarUrl,
		extended_profile: _ext,
		...profileWithoutPhoto
	} = data;

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

export async function PATCH(req: NextRequest) {
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
	console.log("[profile/save] user:", user.id);
	console.log("[profile/save] supabase host:", supabaseHost());

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
			"id, email, full_name, phone, location, headline, experience_summary, portfolio_url, linkedin_url, avatar_url, skills, extended_profile"
		)
		.eq("id", user.id)
		.maybeSingle();

	const existingAvatar = normalizeR2Key(existing?.avatar_url);
	console.log(
		"[profile/save] existing avatar column:",
		abbreviate(existingAvatar)
	);
	let existingExtended: any = {};
	if (existing?.extended_profile) {
		if (typeof existing.extended_profile === "string") {
			try {
				existingExtended = JSON.parse(existing.extended_profile);
			} catch {
				existingExtended = {};
			}
		} else if (typeof existing.extended_profile === "object") {
			existingExtended = existing.extended_profile;
		}
	}

	const baseExtended = {
		work_experience: existingExtended.work_experience || [],
		education: existingExtended.education || [],
		custom_fields: existingExtended.custom_fields || [],
		customSections: existingExtended.customSections || [],
		github_url: existingExtended.github_url || "",
		avatar_url: existingExtended.avatar_url ?? existingAvatar ?? null,
	};

	const baseProfile = {
		email: normalizeString(existing?.email),
		full_name: normalizeString(existing?.full_name),
		phone: normalizeString(existing?.phone),
		location: normalizeString(existing?.location),
		website: normalizeString(existing?.portfolio_url),
		linkedin_url: normalizeString(existing?.linkedin_url),
		bio: normalizeString(
			existing?.experience_summary ?? existing?.headline ?? null
		),
		skills: Array.isArray(existing?.skills) ? existing?.skills : [],
	};

	const nextExtended = { ...baseExtended };
	const nextProfile = { ...baseProfile };

	const email = normalizeString(profile.email);
	if (email !== undefined) nextProfile.email = email;
	const name = normalizeString(profile.full_name);
	if (name !== undefined) nextProfile.full_name = name;
	const phone = normalizeString(profile.phone);
	if (phone !== undefined) nextProfile.phone = phone;
	const location = normalizeString(profile.location);
	if (location !== undefined) nextProfile.location = location;
	const website = normalizeString(profile.website);
	if (website !== undefined) nextProfile.website = website;
	const linkedin = normalizeString(profile.linkedin_url);
	if (linkedin !== undefined) nextProfile.linkedin_url = linkedin;
	const bio = normalizeString(profile.bio);
	if (bio !== undefined) nextProfile.bio = bio;
	if (Array.isArray(profile.skills)) nextProfile.skills = profile.skills;

	if (profile.work_experience !== undefined) {
		nextExtended.work_experience = profile.work_experience || [];
	}
	if (profile.education !== undefined) {
		nextExtended.education = profile.education || [];
	}
	if (profile.custom_fields !== undefined) {
		nextExtended.custom_fields = profile.custom_fields || [];
	}
	if (profile.github_url !== undefined) {
		nextExtended.github_url = profile.github_url || "";
	}
	if (customSectionsInput !== undefined) {
		nextExtended.customSections = customSectionsInput;
	}

	let avatarKey: string | null = existingAvatar;
	let avatarChanged = false;

	if (
		(!r2Client || !serverEnv.r2Bucket) &&
		(profile.avatar_url || "").toString().startsWith("data:")
	) {
		return NextResponse.json(
			{ error: "File storage is not configured." },
			{ status: 503 }
		);
	}

	if (profile.avatar_url !== undefined) {
		const avatarVal = profile.avatar_url;
		if (avatarVal === null || avatarVal === "") {
			avatarKey = null;
			avatarChanged = true;
		} else if (typeof avatarVal === "string") {
			const candidate = avatarVal.trim();
			if (candidate.startsWith("data:")) {
				try {
					const uploaded = await uploadDataUrl(candidate, user.id);
					if (uploaded) {
						avatarKey = uploaded;
						avatarChanged = true;
					}
				} catch (err) {
					console.error("Failed to upload photo from data URL:", err);
				}
			} else if (!candidate.startsWith("blob:")) {
				const normalized = normalizeR2Key(candidate);
				avatarChanged = normalized !== existingAvatar;
				avatarKey = normalized;
			}
		}
	}

	console.log(
		"[profile/save] incoming avatar payload:",
		abbreviate(profile.avatar_url),
		"normalized ->",
		abbreviate(avatarKey),
		"changed?",
		avatarChanged
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
		nextProfile.email ?? baseProfile.email ?? user.email ?? null;
	if (!finalEmail) {
		return NextResponse.json({ error: "Email is required." }, { status: 400 });
	}
	// Ensure we carry forward resolved email/full_name for updates.
	nextProfile.email = finalEmail;
	nextProfile.full_name = finalFullName;

	const updatePayload: Record<string, any> = {
		id: user.id,
		email: finalEmail,
		full_name: finalFullName,
	};
	// Always mark as changed so required fields persist; other fields are marked below.
	let hasChanges = true;
	const mark = (column: string, value: any, baseline: any) => {
		if (value === undefined) return;
		if (isDifferent(value, baseline)) {
			updatePayload[column] = value;
			hasChanges = true;
		}
	};

	mark("phone", nextProfile.phone ?? null, baseProfile.phone ?? null);
	mark("location", nextProfile.location ?? null, baseProfile.location ?? null);
	mark(
		"portfolio_url",
		nextProfile.website ?? null,
		baseProfile.website ?? null
	);
	mark(
		"linkedin_url",
		nextProfile.linkedin_url ?? null,
		baseProfile.linkedin_url ?? null
	);

	if (bio !== undefined) {
		mark("headline", nextProfile.bio ?? null, baseProfile.bio ?? null);
		mark(
			"experience_summary",
			nextProfile.bio ?? null,
			baseProfile.bio ?? null
		);
	}

	if (profile.skills !== undefined) {
		mark(
			"skills",
			Array.isArray(nextProfile.skills) ? nextProfile.skills : [],
			Array.isArray(baseProfile.skills) ? baseProfile.skills : []
		);
	}

	if (avatarChanged) {
		updatePayload.avatar_url = avatarKey;
		hasChanges = true;
	}

	const extendedProfileJson = JSON.stringify(nextExtended);
	const extendedChanged = isDifferent(nextExtended, baseExtended);
	if (extendedChanged || avatarChanged) {
		updatePayload.extended_profile = extendedProfileJson;
		hasChanges = true;
	}

	console.log(
		"[profile/save] upsert payload avatar_url:",
		abbreviate(updatePayload.avatar_url),
		"extendedChanged?",
		extendedChanged,
		"avatarChanged?",
		avatarChanged
	);

	if (!existing && !hasChanges) {
		return NextResponse.json(
			{ error: "Nothing to save. Provide at least one field." },
			{ status: 400 }
		);
	}

	if (hasChanges) {
		updatePayload.updated_at = new Date().toISOString();
	}

	if (!hasChanges) {
		const signedAvatarUrl = await signPhotoUrl(avatarKey);
		return NextResponse.json(
			{
				ok: true,
				saved: false,
				id: existing?.id || user.id,
				avatar_url: signedAvatarUrl,
			},
			{ status: 200 }
		);
	}

	const { data, error } = await admin
		.from("profiles")
		.upsert(updatePayload)
		.select("id, avatar_url")
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

	const signedAvatarUrl = await signPhotoUrl(data.avatar_url);
	console.log(
		"[profile/save] saved avatar column:",
		abbreviate(data.avatar_url),
		"signed:",
		abbreviate(signedAvatarUrl)
	);
	try {
		const { data: verify } = await admin
			.from("profiles")
			.select("avatar_url")
			.eq("id", user.id)
			.single();
		console.log(
			"[profile/save] verify read avatar column:",
			abbreviate(verify?.avatar_url)
		);
	} catch (e) {
		console.warn("[profile/save] verify read failed", e);
	}

	return NextResponse.json(
		{
			ok: true,
			saved: true,
			id: data.id,
			avatar_url: signedAvatarUrl,
		},
		{ status: 200 }
	);
}

export const POST = PATCH;
