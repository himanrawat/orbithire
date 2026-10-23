import { NextResponse } from "next/server";
import { OAUTH_COOKIE_PATH, OAUTH_STATE_COOKIE, getGoogleClientConfig } from "@/lib/calendar/google/config";
import { buildAuthorizeUrl, createOAuthState } from "@/lib/calendar/google/oauth";
import { requireUser } from "@/lib/focus/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_MAX_AGE_SECONDS = 600;

/**
 * GET /api/calendar/google/connect – starts Google OAuth. The state and PKCE verifier go in
 * a short-lived httpOnly cookie that the callback checks (CSRF protection).
 */
export async function GET() {
	const auth = await requireUser();
	const config = getGoogleClientConfig();
	if (!auth || !config) return NextResponse.json({ error: "Not available" }, { status: auth ? 404 : 401 });

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
