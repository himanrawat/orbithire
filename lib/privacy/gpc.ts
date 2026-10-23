/**
 * Global Privacy Control (https://globalprivacycontrol.org).
 *
 * Browsers with GPC on send `Sec-GPC: 1` and expose `navigator.globalPrivacyControl`.
 * Under CCPA/CPRA and similar US state laws, that signal is a valid opt-out of the
 * sale or sharing of personal data. NextMilestone sells or shares no personal data,
 * so the opt-out is already in effect for everyone; we still honor the signal by
 * turning off anything non-essential (analytics, ad or marketing pixels) for that
 * browser.
 *
 * middleware.ts mirrors the header into the GPC_COOKIE / GPC_REQUEST_HEADER so server
 * components and client code can read it. This file has no server-only imports so the
 * edge middleware and client components can both use it.
 */

export const GPC_HEADER = "sec-gpc";
export const GPC_COOKIE = "nm_gpc";
/** Set on the forwarded request by middleware so server components see the signal. */
export const GPC_REQUEST_HEADER = "x-nm-gpc";
export const GPC_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type HeaderReader = Readonly<{ get(name: string): string | null }>;
type CookieReader = Readonly<{ get(name: string): { value: string } | undefined }>;

/** The spec allows only "1"; surrounding whitespace is tolerated. */
export function isGpcHeaderValue(value: string | null | undefined): boolean {
	return value?.trim() === "1";
}

export function hasGpcSignal(headers: HeaderReader): boolean {
	return (
		isGpcHeaderValue(headers.get(GPC_HEADER)) ||
		isGpcHeaderValue(headers.get(GPC_REQUEST_HEADER))
	);
}

/** Server side: true when the request carries GPC, or a recent request did (cookie). */
export function isGpcEnabled(headers: HeaderReader, cookies?: CookieReader): boolean {
	return hasGpcSignal(headers) || isGpcHeaderValue(cookies?.get(GPC_COOKIE)?.value);
}

/** Client side: reads `navigator.globalPrivacyControl` and the middleware cookie. */
export function isGpcEnabledInBrowser(
	nav: Readonly<{ globalPrivacyControl?: boolean }> | undefined,
	cookieString: string | undefined
): boolean {
	if (nav?.globalPrivacyControl === true) return true;
	return (cookieString ?? "")
		.split(";")
		.some((part) => part.trim() === `${GPC_COOKIE}=1`);
}

/**
 * Gate for every non-essential script or tracking call. Essential features (sign-in,
 * security, the product itself) never check this. Today the app loads no analytics;
 * anything added later (PostHog, pixels) must call this first.
 */
export function shouldLoadNonEssentialTracking(gpcEnabled: boolean): boolean {
	return !gpcEnabled;
}
