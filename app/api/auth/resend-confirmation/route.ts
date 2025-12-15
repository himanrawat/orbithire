import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

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

		// Resend confirmation email using Supabase's resend method
		const { error } = await supabase.auth.resend({
			type: "signup",
			email,
		});

		if (error) {
			// Don't expose whether the email exists or not for security
			if (error.message.includes("rate limit")) {
				return NextResponse.json(
					{ error: "Too many requests. Please wait a few minutes and try again." },
					{ status: 429 }
				);
			}
			return NextResponse.json(
				{ error: "Failed to resend confirmation email. Please try again." },
				{ status: 400 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Confirmation email sent. Please check your inbox and spam folder.",
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
