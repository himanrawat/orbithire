import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { serverEnv } from "@/lib/config";
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
			scope: "auth.password_reset",
			limit: 4,
			windowSeconds: 60 * 60,
			identifier: email,
			captchaAfter: 2,
			captchaToken: req.headers.get("x-captcha-token"),
		});
		if (limited) return limited;

		const supabase = createServerSupabase();

		// Send password reset email
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${serverEnv.siteUrl}/reset-password`,
		});

		if (error) console.error("Password reset provider error:", error.message);

		return NextResponse.json({
			success: true,
			message: "If an account exists, a password reset link has been sent.",
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
