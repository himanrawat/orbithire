import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
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
			scope: "auth.signin",
			limit: 8,
			windowSeconds: 15 * 60,
			identifier: email,
			captchaAfter: 3,
			captchaToken: req.headers.get("x-captcha-token"),
		});
		if (limited) return limited;

		const supabase = createServerSupabase();
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
		}

		return NextResponse.json({
			success: true,
			user: data.user,
		});
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
