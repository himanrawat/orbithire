import { NextResponse } from "next/server";
import { OAUTH_COOKIE_PATH, OAUTH_STATE_COOKIE, getGoogleClientConfig } from "@/lib/calendar/google/config";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/calendar/google/oauth";
import { requireUser } from "@/lib/focus/server";
import { canUse, getPlan } from "@/lib/billing/plan";
import { UPGRADE_HREF } from "@/lib/billing/gates";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_MAX_AGE_SECONDS = 600;

/**
 * GET /api/calendar/google/connect – starts Google OAuth. The state and PKCE verifier go in
 * a short-lived httpOnly cookie that the callback checks (CSRF protection). Pro only.
 */
export async function GET() {
	const auth = await requireUser();
	const config = getGoogleClientConfig();
	if (!auth || !config) return NextResponse.json({ error: "Not available" }, { status: auth ? 404 : 401 });
	// Calendar sync is Pro. This is a browser navigation, so send Free users to pricing.
	if (!canUse(await getPlan(auth.userId, auth.supabase), "calendar_sync")) {
		return NextResponse.redirect(new URL(UPGRADE_HREF, serverEnv.siteUrl));
	}

	const { state, verifier, cookieValue } = createOAuthState();
	const response = NextResponse.redirect(buildAuthorizeUrl(config, state, verifier));
	response.cookies.set(OAUTH_STATE_COOKIE, cookieValue, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: OAUTH_COOKIE_PATH,
		maxAge: STATE_MAX_AGE_SECONDS,
	});
	return response;
}
