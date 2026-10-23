import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE_PATH, OAUTH_STATE_COOKIE, getGoogleClientConfig } from "@/lib/calendar/google/config";
import { saveConnection } from "@/lib/calendar/google/connection";
import { exchangeCode, fetchGoogleEmail, verifyOAuthState } from "@/lib/calendar/google/oauth";
import { requireUser } from "@/lib/focus/server";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Outcome = "connected" | "denied" | "error";

function settingsRedirect(outcome: Outcome) {
	const url = new URL("/settings", serverEnv.siteUrl);
	url.searchParams.set("tab", "integrations");
	url.searchParams.set("calendar", outcome);
	const response = NextResponse.redirect(url);
	response.cookies.set(OAUTH_STATE_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });
	return response;
}

async function connect(req: NextRequest, userId: string): Promise<Outcome> {
	const params = req.nextUrl.searchParams;
	if (params.get("error")) return "denied";
	const config = getGoogleClientConfig();
	const verifier = verifyOAuthState(req.cookies.get(OAUTH_STATE_COOKIE)?.value, params.get("state"));
	const code = params.get("code");
	if (!config || !verifier || !code) return "error";

	const tokens = await exchangeCode(config, code, verifier);
	const email = await fetchGoogleEmail(tokens.accessToken);
	await saveConnection(userId, tokens, email);
	return "connected";
}

/** GET /api/calendar/google/callback – Google's redirect after consent. */
export async function GET(req: NextRequest) {
	const auth = await requireUser();
	if (!auth) return NextResponse.redirect(new URL("/signin", serverEnv.siteUrl));
	try {
		return settingsRedirect(await connect(req, auth.userId));
	} catch (error) {
		console.error("Google Calendar connect failed", error instanceof Error ? error.message : error);
		return settingsRedirect("error");
	}
}
