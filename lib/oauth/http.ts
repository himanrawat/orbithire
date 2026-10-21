/** HTTP helpers shared by the OAuth route handlers. */

/**
 * OAuth endpoints are called by MCP clients, sometimes from a browser (e.g.
 * MCP Inspector). They never use cookies, so a wildcard CORS policy is safe.
 */
export const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
	"Access-Control-Max-Age": "86400",
};

export function preflight(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
			Pragma: "no-cache",
			...CORS_HEADERS,
			...headers,
		},
	});
}

/** Public metadata documents: cacheable for a short while. */
export function metadata(body: unknown): Response {
	return new Response(JSON.stringify(body, null, 2), {
		status: 200,
		headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", ...CORS_HEADERS },
	});
}

export type OAuthErrorCode =
	| "invalid_request"
	| "invalid_client"
	| "invalid_grant"
	| "unauthorized_client"
	| "unsupported_grant_type"
	| "invalid_scope"
	| "invalid_target"
	| "invalid_redirect_uri"
	| "invalid_client_metadata"
	| "unsupported_token_type"
	| "access_denied"
	| "server_error"
	| "temporarily_unavailable";

export function oauthError(
	error: OAuthErrorCode,
	description: string,
	status = 400,
	headers: Record<string, string> = {}
): Response {
	return json({ error, error_description: description }, status, headers);
}

/** Read an application/x-www-form-urlencoded body (JSON accepted as a courtesy). */
export async function readParams(req: Request): Promise<URLSearchParams> {
	const type = (req.headers.get("content-type") || "").toLowerCase();
	const raw = await req.text();
	if (raw.length > 64_000) return new URLSearchParams();
	if (type.includes("application/json")) {
		try {
			const obj = JSON.parse(raw) as Record<string, unknown>;
			const p = new URLSearchParams();
			for (const [k, v] of Object.entries(obj || {})) {
				if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") p.set(k, String(v));
			}
			return p;
		} catch {
			return new URLSearchParams();
		}
	}
	return new URLSearchParams(raw);
}

/** Client credentials from `Authorization: Basic` (RFC 6749 §2.3.1) or the body. */
export function clientCredentials(
	req: Request,
	params: URLSearchParams
): { clientId: string | null; clientSecret: string | null; method: "basic" | "post" | "none" } {
	const auth = req.headers.get("authorization");
	const m = auth?.match(/^Basic\s+(.+)$/i);
	if (m) {
		try {
			const decoded = Buffer.from(m[1], "base64").toString("utf8");
			const i = decoded.indexOf(":");
			if (i > 0) {
				return {
					clientId: decodeURIComponent(decoded.slice(0, i).replace(/\+/g, "%20")),
					clientSecret: decodeURIComponent(decoded.slice(i + 1).replace(/\+/g, "%20")),
					method: "basic",
				};
			}
		} catch {
			/* fall through */
		}
	}
	const secret = params.get("client_secret");
	return { clientId: params.get("client_id"), clientSecret: secret, method: secret ? "post" : "none" };
}

/** Best-effort caller IP for rate limiting. */
export function callerIp(req: Request): string {
	return (
		req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
		req.headers.get("x-real-ip") ||
		"unknown"
	);
}

/** Tiny fixed-window in-memory limiter (per process). */
const buckets = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number): boolean {
	const now = Date.now();
	const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
	if (recent.length >= max) {
		buckets.set(key, recent);
		return true;
	}
	recent.push(now);
	buckets.set(key, recent);
	if (buckets.size > 5000) buckets.clear();
	return false;
}
