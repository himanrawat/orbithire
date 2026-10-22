import "server-only";

import { createHash } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { getRequestIp } from "@/lib/api";

type RateLimitOptions = {
	scope: string;
	limit: number;
	windowSeconds: number;
	identifier?: string;
	captchaAfter?: number;
	captchaToken?: string | null;
};

type RateLimitResult = {
	allowed: boolean;
	count: number;
	retry_after: number;
};

function digest(value: string) {
	return createHash("sha256").update(value).digest("hex");
}

async function verifyCaptcha(token: string, ip: string) {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) return true;
	if (!token) return false;
	try {
		const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ secret, response: token, remoteip: ip }),
			cache: "no-store",
		});
		const result = (await response.json()) as { success?: boolean };
		return response.ok && result.success === true;
	} catch (error) {
		console.error("CAPTCHA verification failed:", error);
		return false;
	}
}

export async function enforceRateLimit(
	req: NextRequest,
	options: RateLimitOptions
): Promise<NextResponse | null> {
	const ip = getRequestIp(req);
	const identity = `${ip}:${options.identifier?.trim().toLowerCase() || "-"}`;
	const supabase = createServiceSupabase();
	const { data, error } = await supabase.rpc("consume_rate_limit", {
		p_key_hash: digest(identity),
		p_scope: options.scope,
		p_limit: options.limit,
		p_window_seconds: options.windowSeconds,
	});

	if (error) {
		console.error("Rate limit check failed:", error);
		return NextResponse.json(
			{ error: "Request protection is temporarily unavailable." },
			{ status: 503 }
		);
	}

	const result = data as RateLimitResult;
	if (result.allowed) {
		const captchaRequired = options.captchaAfter !== undefined && result.count > options.captchaAfter;
		if (!captchaRequired || await verifyCaptcha(options.captchaToken || "", ip)) return null;
		await supabase.from("security_events").insert({
			event_type: "captcha.failed",
			scope: options.scope,
			key_hash: digest(identity),
			metadata: { count: result.count },
		});
		return NextResponse.json(
			{ error: "Please complete the security check and try again.", code: "captcha_required" },
			{ status: 403 }
		);
	}

	await supabase.from("security_events").insert({
		event_type: "rate_limit.exceeded",
		scope: options.scope,
		key_hash: digest(identity),
		metadata: { count: result.count },
	});

	return NextResponse.json(
		{ error: "Too many requests. Please try again later." },
		{
			status: 429,
			headers: { "Retry-After": String(Math.max(1, result.retry_after)) },
		}
	);
}
