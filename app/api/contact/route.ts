import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { z } from "zod";
import { parseJson } from "@/lib/api";
import { enforceRateLimit } from "@/lib/requestSecurity";

const schema = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
	subject: z.string().trim().min(1).max(200),
	message: z.string().trim().min(1).max(5000),
}).strict();

export async function POST(req: NextRequest) {
	try {
		const parsed = await parseJson(req, schema);
		if (!parsed.success) return parsed.response;
		const { name, email, subject, message } = parsed.data;
		const limited = await enforceRateLimit(req, {
			scope: "public.contact",
			limit: 5,
			windowSeconds: 60 * 60,
			identifier: email,
			captchaAfter: 2,
			captchaToken: req.headers.get("x-captcha-token"),
		});
		if (limited) return limited;

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
