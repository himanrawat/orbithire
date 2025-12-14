/**
 * Shared authentication utilities.
 * These functions are used across pages, components, and middleware.
 */

/**
 * Check if any Supabase session cookie exists (client-side).
 * IMPORTANT: Exclude -code-verifier cookies (used in PKCE OAuth flow, NOT session cookies)
 */
export function hasSupabaseSessionCookie(): boolean {
	if (typeof document === "undefined") return false;
	const cookies = document.cookie.split(";").map((c) => c.trim());
	return cookies.some((cookie) => {
		const name = cookie.split("=")[0];
		return (
			name.startsWith("sb-") &&
			!name.endsWith("-code-verifier") &&
			(name.endsWith("-auth-token") ||
				name.endsWith("-access-token") ||
				name.endsWith("-refresh-token"))
		);
	});
}

/**
 * Sanitize and validate redirect URLs to prevent open redirect vulnerabilities.
 */
export function sanitizeRedirect(raw: string | null, fallback = ""): string {
	if (!raw) return fallback;
	const trimmed = raw.trim();
	if (!trimmed) return fallback;
	if (/^\/\//.test(trimmed)) return fallback;
	if (/^javascript:/i.test(trimmed)) return fallback;

	// Allow relative paths
	if (trimmed.startsWith("/")) return trimmed;

	// Validate absolute URLs
	try {
		const url = new URL(trimmed);
		const allowedHosts = new Set(
			[
				typeof window !== "undefined" ? window.location.host : null,
				"localhost:3000",
				"127.0.0.1:3000",
				"dashboard.himanshurawat.in",
				"resume.himanshurawat.in",
				"himanshurawat.in",
				"www.himanshurawat.in",
			].filter(Boolean)
		);

		if (
			(url.protocol === "http:" || url.protocol === "https:") &&
			allowedHosts.has(url.host)
		) {
			const normalizedPath = `${url.pathname}${url.search}${url.hash}`;
			if (typeof window !== "undefined" && url.host === window.location.host) {
				return normalizedPath;
			}
			return url.toString();
		}
		return fallback;
	} catch {
		return fallback;
	}
}
