import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { serverEnv } from "@/lib/config";

export async function POST(req: NextRequest) {
	try {
		const { email } = await req.json();

		if (!email) {
			return NextResponse.json(
				{ error: "Email is required" },
				{ status: 400 }
			);
		}

		const supabase = createServerSupabase();

		// Check if user exists in profiles table
		const { data: profile } = await supabase
			.from("profiles")
			.select("id")
			.eq("email", email.toLowerCase())
			.single();

		if (!profile) {
			return NextResponse.json(
				{ error: "No account found with this email. Please sign up first." },
				{ status: 404 }
			);
		}

		// Send password reset email
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${serverEnv.siteUrl}/reset-password`,
		});

		if (error) {
			if (error.message.includes("rate limit")) {
				return NextResponse.json(
					{ error: "Too many requests. Please wait a few minutes and try again." },
					{ status: 429 }
				);
			}
			console.error("Password reset error:", error);
			return NextResponse.json(
				{ error: "Failed to send password reset email. Please try again." },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Password reset link has been sent to your email.",
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
