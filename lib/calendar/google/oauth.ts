// Google OAuth 2.0 over plain fetch: authorize URL (with state and PKCE), code exchange,
// refresh and revoke. No SDK.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
	GOOGLE_AUTHORIZE_URL,
	GOOGLE_CALENDAR_SCOPES,
	GOOGLE_REVOKE_URL,
	GOOGLE_TOKEN_URL,
	GOOGLE_USERINFO_URL,
	type GoogleClientConfig,
} from "./config";

export type GoogleTokens = Readonly<{
	accessToken: string;
	refreshToken: string | null;
	expiresAt: string | null;
	scope: string | null;
}>;

export class GoogleAuthError extends Error {
	constructor(
		message: string,
		readonly code: string | null
	) {
		super(message);
		this.name = "GoogleAuthError";
	}
}

function base64Url(buffer: Buffer) {
	return buffer.toString("base64url");
}

export function createOAuthState() {
	const state = base64Url(randomBytes(24));
	const verifier = base64Url(randomBytes(48));
	return { state, verifier, cookieValue: `${state}.${verifier}` };
}

export function codeChallenge(verifier: string) {
	return base64Url(createHash("sha256").update(verifier).digest());
}

/** Checks the returned state against the cookie in constant time; returns the PKCE verifier. */
export function verifyOAuthState(cookieValue: string | undefined, returnedState: string | null): string | null {
	if (!cookieValue || !returnedState) return null;
	const [state, verifier] = cookieValue.split(".");
	if (!state || !verifier) return null;
	const a = Buffer.from(state);
	const b = Buffer.from(returnedState);
	if (a.length !== b.length || !timingSafeEqual(new Uint8Array(a), new Uint8Array(b))) return null;
	return verifier;
}

export function buildAuthorizeUrl(config: GoogleClientConfig, state: string, verifier: string, loginHint?: string) {
	const url = new URL(GOOGLE_AUTHORIZE_URL);
	url.searchParams.set("client_id", config.clientId);
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
	url.searchParams.set("access_type", "offline");
	url.searchParams.set("include_granted_scopes", "true");
	url.searchParams.set("prompt", "consent");
	url.searchParams.set("state", state);
	url.searchParams.set("code_challenge", codeChallenge(verifier));
	url.searchParams.set("code_challenge_method", "S256");
	if (loginHint) url.searchParams.set("login_hint", loginHint);
	return url.toString();
}

type TokenResponse = {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	scope?: string;
	error?: string;
	error_description?: string;
};

export function toTokens(body: TokenResponse, now: number, previousRefresh: string | null = null): GoogleTokens {
	if (!body.access_token) throw new GoogleAuthError(body.error_description || "No access token", body.error ?? null);
	return {
		accessToken: body.access_token,
		refreshToken: body.refresh_token ?? previousRefresh,
		expiresAt: typeof body.expires_in === "number" ? new Date(now + body.expires_in * 1000).toISOString() : null,
		scope: body.scope ?? null,
	};
}

async function postToken(params: Record<string, string>, fetchImpl: typeof fetch): Promise<TokenResponse> {
	const res = await fetchImpl(GOOGLE_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
		cache: "no-store",
	});
	const body = (await res.json().catch(() => ({}))) as TokenResponse;
	if (!res.ok) throw new GoogleAuthError(body.error_description || `Token request failed (${res.status})`, body.error ?? null);
	return body;
}

export async function exchangeCode(
	config: GoogleClientConfig,
	code: string,
	verifier: string,
	fetchImpl: typeof fetch = fetch
): Promise<GoogleTokens> {
	const body = await postToken(
		{
			code,
			client_id: config.clientId,
			client_secret: config.clientSecret,
			redirect_uri: config.redirectUri,
			grant_type: "authorization_code",
			code_verifier: verifier,
		},
		fetchImpl
	);
	return toTokens(body, Date.now());
}

export async function refreshAccessToken(
	config: GoogleClientConfig,
	refreshToken: string,
	fetchImpl: typeof fetch = fetch
): Promise<GoogleTokens> {
	const body = await postToken(
		{
			client_id: config.clientId,
			client_secret: config.clientSecret,
			refresh_token: refreshToken,
			grant_type: "refresh_token",
		},
		fetchImpl
	);
	return toTokens(body, Date.now(), refreshToken);
}

/** Revoking either token revokes the grant. Failures are reported, not thrown. */
export async function revokeToken(token: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
	try {
		const res = await fetchImpl(GOOGLE_REVOKE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ token }).toString(),
			cache: "no-store",
		});
		return res.ok;
	} catch {
		return false;
	}
}

export async function fetchGoogleEmail(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
	try {
		const res = await fetchImpl(GOOGLE_USERINFO_URL, {
			headers: { Authorization: `Bearer ${accessToken}` },
			cache: "no-store",
		});
		if (!res.ok) return null;
		const body = (await res.json()) as { email?: unknown };
		return typeof body.email === "string" ? body.email.slice(0, 320) : null;
	} catch {
		return null;
	}
}

/** True when the token should be refreshed before use (a minute of slack). */
export function isExpiring(expiresAt: string | null, now: number) {
	if (!expiresAt) return false;
	return Date.parse(expiresAt) - now < 60_000;
}
