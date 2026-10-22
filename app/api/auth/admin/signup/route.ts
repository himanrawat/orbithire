import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { parseJson } from "@/lib/api";
import { enforceRateLimit } from "@/lib/requestSecurity";

const schema = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
	password: z.string().min(8).max(256),
	accessCode: z.string().trim().min(6).max(128),
}).strict();

export async function POST(req: NextRequest) {
	try {
		const parsed = await parseJson(req, schema);
		if (!parsed.success) return parsed.response;
		const { name, email, password, accessCode } = parsed.data;
		const limited = await enforceRateLimit(req, {
			scope: "admin.signup",
			limit: 5,
			windowSeconds: 60 * 60,
			identifier: email,
			captchaAfter: 2,
			captchaToken: req.headers.get("x-captcha-token"),
		});
		if (limited) return limited;

		const supabase = createServiceSupabase();

		// Verify access code
		const { data: codeData, error: codeError } = await supabase
			.from("admin_access_codes")
			.select("id, used_by, expires_at, is_active")
			.eq("code", accessCode)
			.single();

		if (codeError || !codeData) {
			return NextResponse.json(
				{ error: "Invalid access code" },
				{ status: 400 }
			);
		}

		if (!codeData.is_active) {
			return NextResponse.json(
				{ error: "Access code is no longer active" },
				{ status: 400 }
			);
		}

		if (codeData.used_by) {
			return NextResponse.json(
				{ error: "Access code has already been used" },
				{ status: 400 }
			);
		}

		if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
			return NextResponse.json(
				{ error: "Access code has expired" },
				{ status: 400 }
			);
		}

		// Check if email already exists
		const { data: existingAdmin } = await supabase
			.from("admin_users")
			.select("id")
			.eq("email", email)
			.single();

		if (existingAdmin) {
			return NextResponse.json(
				{ error: "Email is already registered" },
				{ status: 400 }
			);
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 12);

		// Create admin user
		const { data: newAdmin, error: createError } = await supabase
			.from("admin_users")
			.insert({
				email,
				password_hash: passwordHash,
				name,
			})
			.select("id")
			.single();

		if (createError || !newAdmin) {
			console.error("Error creating admin:", createError);
			return NextResponse.json(
				{ error: "Failed to create admin account" },
				{ status: 500 }
			);
		}

		// Mark access code as used
		await supabase
			.from("admin_access_codes")
			.update({
				used_by: newAdmin.id,
				used_at: new Date().toISOString(),
			})
			.eq("id", codeData.id);

		return NextResponse.json({
			success: true,
			message: "Admin account created successfully",
		});
	} catch (error) {
		console.error("Admin signup error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
