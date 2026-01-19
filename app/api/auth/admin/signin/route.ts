import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
	try {
		const { email, password } = await req.json();

		if (!email || !password) {
			return NextResponse.json(
				{ error: "Email and password are required" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		// Find admin by email
		const { data: admin, error } = await supabase
			.from("admin_users")
			.select("id, email, name, password_hash, is_active")
			.eq("email", email.toLowerCase())
			.single();

		if (error || !admin) {
			return NextResponse.json(
				{ error: "Invalid credentials" },
				{ status: 401 }
			);
		}

		if (!admin.is_active) {
			return NextResponse.json(
				{ error: "Account is deactivated" },
				{ status: 401 }
			);
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

		// Set admin session cookie
		const cookieStore = cookies();
		cookieStore.set("admin_token", admin.id, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 7, // 7 days
		});

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
