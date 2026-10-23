// Google Calendar settings. The feature is hidden unless both client env vars are set.
//
// Scopes (least privilege, documented for Google's verification, PRD research R4):
// - calendar.events.readonly: read events on the user's primary calendar for the week view.
//   We never write to existing calendars.
// - calendar.app.created: create one secondary "NextMilestone" calendar and manage events on
//   calendars this app created, and nothing else. This is narrower than calendar.events or
//   calendar.events.owned (both can change any event the user owns), and it guarantees we can
//   only write the blocks the user creates in NextMilestone.
// - openid email: show which Google account is connected.

import { serverEnv } from "@/lib/config";

export const GOOGLE_CALENDAR_SCOPES = [
	"openid",
	"email",
	"https://www.googleapis.com/auth/calendar.events.readonly",
	"https://www.googleapis.com/auth/calendar.app.created",
] as const;

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export const APP_CALENDAR_NAME = "NextMilestone";
export const OAUTH_STATE_COOKIE = "nm_gcal_oauth";
export const OAUTH_COOKIE_PATH = "/api/calendar/google";

export type GoogleClientConfig = Readonly<{ clientId: string; clientSecret: string; redirectUri: string }>;

export function isGoogleCalendarConfigured(): boolean {
	return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function getGoogleClientConfig(): GoogleClientConfig | null {
	const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
	if (!clientId || !clientSecret) return null;
	const redirectUri =
		process.env.GOOGLE_CALENDAR_REDIRECT_URI || new URL("/api/calendar/google/callback", serverEnv.siteUrl).toString();
	return { clientId, clientSecret, redirectUri };
}
