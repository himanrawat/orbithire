/** Signed consent-form payload shared by /oauth/authorize (page) and /api/oauth/authorize (decision). */
import { CONSENT_TTL_SECONDS } from "./config";
import { signPayload, verifyPayload } from "./crypto";
import type { AuthorizationRequest } from "./grants";

export interface ConsentPayload {
	/** The validated authorization request. */
	r: AuthorizationRequest;
	/** User id the consent screen was shown to. */
	u: string;
	/** Client name at the time (for the grant snapshot). */
	n: string;
	/** Expiry, epoch seconds. */
	exp: number;
}

export function signConsent(request: AuthorizationRequest, userId: string, clientName: string): string {
	return signPayload({
		r: request,
		u: userId,
		n: clientName,
		exp: Math.floor(Date.now() / 1000) + CONSENT_TTL_SECONDS,
	} satisfies ConsentPayload);
}

export function verifyConsent(signed: string | null): ConsentPayload | null {
	const p = verifyPayload<ConsentPayload>(signed);
	if (!p || typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
	if (!p.r || typeof p.r.redirect_uri !== "string" || typeof p.u !== "string") return null;
	return p;
}
