import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
	try {
		const { name, email, subject, message } = await req.json();

		// Validation
		if (!name || !email || !subject || !message) {
			return NextResponse.json(
				{ error: "All fields are required" },
				{ status: 400 }
			);
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return NextResponse.json(
				{ error: "Invalid email address" },
				{ status: 400 }
			);
		}

		// Use service-role client to bypass RLS for public contact form submissions
		const supabase = createServiceSupabase();

		const { error } = await supabase.from("contact_submissions").insert({
			name,
			email,
			subject,
			message,
		});

		if (error) {
			console.error("Contact submission error:", error);
			return NextResponse.json(
				{ error: "Failed to submit message" },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Thank you for your message! We'll get back to you soon.",
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
