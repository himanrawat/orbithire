/** Server-only crypto helpers for the OAuth server. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function randomToken(prefix = "", bytes = 32): string {
	return prefix + randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a);
	const bb = Buffer.from(b);
	return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** RFC 7636 code_verifier: 43–128 chars of [A-Z a-z 0-9 - . _ ~]. */
export function isValidCodeVerifier(v: string): boolean {
	return /^[A-Za-z0-9\-._~]{43,128}$/.test(v);
}

/** RFC 7636 S256 code_challenge: base64url(SHA-256(verifier)), 43 chars. */
export function isValidCodeChallenge(c: string): boolean {
	return /^[A-Za-z0-9_-]{43}$/.test(c);
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
	if (!isValidCodeVerifier(verifier)) return false;
	const computed = createHash("sha256").update(verifier, "ascii").digest("base64url");
	return safeEqual(computed, challenge);
}

/**
 * HMAC key for signing the consent form. Derived from the service role key so
 * no extra secret has to be configured; OAUTH_SIGNING_SECRET overrides it.
 */
function signingKey(): string {
	const secret = process.env.OAUTH_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY (or OAUTH_SIGNING_SECRET) is required for OAuth");
	return createHmac("sha256", secret).update("orbithire-oauth-consent-v1").digest("hex");
}

/** Sign a JSON payload: base64url(json) + "." + base64url(hmac). */
export function signPayload(payload: unknown): string {
	const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
	const mac = createHmac("sha256", signingKey()).update(body).digest("base64url");
	return `${body}.${mac}`;
}

export function verifyPayload<T>(signed: string | null | undefined): T | null {
	if (!signed || typeof signed !== "string") return null;
	const dot = signed.lastIndexOf(".");
	if (dot <= 0) return null;
	const body = signed.slice(0, dot);
	const mac = signed.slice(dot + 1);
	const expected = createHmac("sha256", signingKey()).update(body).digest("base64url");
	if (!safeEqual(mac, expected)) return null;
	try {
		return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
	} catch {
		return null;
	}
}
