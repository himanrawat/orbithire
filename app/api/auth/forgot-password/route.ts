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
			// Don't expose whether the email exists or not for security
			console.error("Password reset error:", error);
		}

		// Always return success to prevent email enumeration
		return NextResponse.json({
			success: true,
			message: "If an account exists with this email, you will receive a password reset link.",
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
