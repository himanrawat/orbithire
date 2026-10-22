import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { createAdminSession } from "@/lib/adminAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { parseJson } from "@/lib/api";
import { enforceRateLimit } from "@/lib/requestSecurity";

const schema = z.object({
	email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
	password: z.string().min(1).max(256),
}).strict();

export async function POST(req: NextRequest) {
	try {
		const parsed = await parseJson(req, schema);
		if (!parsed.success) return parsed.response;
		const { email, password } = parsed.data;
		const limited = await enforceRateLimit(req, {
			scope: "admin.signin",
			limit: 6,
			windowSeconds: 30 * 60,
			identifier: email,
			captchaAfter: 2,
			captchaToken: req.headers.get("x-captcha-token"),
		});
		if (limited) return limited;

		const supabase = createServiceSupabase();

		// Find admin by email
		const { data: admin, error } = await supabase
			.from("admin_users")
			.select("id, email, name, password_hash, is_active")
			.eq("email", email)
			.single();

		if (error || !admin) {
			return NextResponse.json(
				{ error: "Invalid credentials" },
				{ status: 401 }
			);
		}

		if (!admin.is_active) {
			return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, admin.password_hash);
		if (!isValidPassword) {
			return NextResponse.json(
				{ error: "Invalid credentials" },
				{ status: 401 }
			);
		}

		// Update last login
		await supabase
			.from("admin_users")
			.update({ last_login_at: new Date().toISOString() })
			.eq("id", admin.id);

		// Store only an opaque random token in the cookie. The database keeps its hash.
		await createAdminSession(admin.id, req);

		return NextResponse.json({
			success: true,
			admin: {
				id: admin.id,
				email: admin.email,
				name: admin.name,
			},
		});
	} catch (error) {
		console.error("Admin signin error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
