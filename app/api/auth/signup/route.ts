import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

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

function parseDataUrl(dataUrl: string) {
	const match = /^data:(.+?);base64,(.*)$/i.exec(dataUrl);
	if (!match) return null;
	const contentType = match[1];
	const buffer = Buffer.from(match[2], "base64");
	return { contentType, buffer };
}

async function uploadAvatar(dataUrl: string, userId: string) {
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

export async function POST(req: NextRequest) {
	try {
		const { email, password, name, phone, avatar } = await req.json();

		// Basic validation
		if (!email || !password) {
			return NextResponse.json(
				{ error: "Email and password are required" },
				{ status: 400 }
			);
		}

		if (!name?.trim()) {
			return NextResponse.json(
				{ error: "Name is required" },
				{ status: 400 }
			);
		}

		if (password.length < 6) {
			return NextResponse.json(
				{ error: "Password must be at least 6 characters" },
				{ status: 400 }
			);
		}

		const supabase = createServerSupabase();
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					full_name: name.trim(),
				},
			},
		});

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		// Create profile record if user was created successfully
		if (data.user && serverEnv.supabaseServiceRoleKey) {
			const admin = createClient(
				serverEnv.supabaseUrl,
				serverEnv.supabaseServiceRoleKey,
				{
					auth: { autoRefreshToken: false, persistSession: false },
				}
			);

			let avatarKey: string | null = null;

			// Upload avatar if provided
			if (avatar && typeof avatar === "string" && avatar.startsWith("data:")) {
				try {
					avatarKey = await uploadAvatar(avatar, data.user.id);
				} catch (err) {
					console.error("Failed to upload avatar during signup:", err);
					// Don't fail signup if avatar upload fails
				}
			}

			// Create or update profile
			const { error: profileError } = await admin.from("profiles").upsert({
				id: data.user.id,
				email: email,
				full_name: name.trim(),
				phone: phone?.trim() || null,
				avatar_url: avatarKey,
				extended_profile: JSON.stringify({
					avatar_url: avatarKey,
					work_experience: [],
					education: [],
					custom_fields: [],
					customSections: [],
					github_url: "",
				}),
				updated_at: new Date().toISOString(),
			});

			if (profileError) {
				console.error("Failed to create profile during signup:", profileError);
				// Don't fail signup if profile creation fails - it can be created later
			}
		}

		return NextResponse.json({
			success: true,
			message: "Check your email for confirmation link",
			user: data.user,
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
