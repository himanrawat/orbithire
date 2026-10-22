import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { z } from "zod";
import { parseJson } from "@/lib/api";
import { enforceRateLimit } from "@/lib/requestSecurity";

const schema = z.object({
	email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
}).strict();

export async function POST(req: NextRequest) {
	try {
		const parsed = await parseJson(req, schema);
		if (!parsed.success) return parsed.response;
		const { email } = parsed.data;
		const limited = await enforceRateLimit(req, {
			scope: "auth.resend_confirmation",
			limit: 4,
			windowSeconds: 60 * 60,
			identifier: email,
			captchaAfter: 2,
			captchaToken: req.headers.get("x-captcha-token"),
		});
		if (limited) return limited;

		const supabase = createServerSupabase();

		// Resend confirmation email using Supabase's resend method
		const { error } = await supabase.auth.resend({
			type: "signup",
			email,
		});

		if (error) console.error("Confirmation resend provider error:", error.message);

		return NextResponse.json({
			success: true,
			message: "If the account is eligible, a confirmation email has been sent.",
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
