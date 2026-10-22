/**
 * OAuth 2.1 authorization server for the NextMilestone MCP endpoint (Phase 5).
 *
 * The app is both the authorization server (issuer = the app origin) and the
 * protected resource (`<origin>/api/mcp`). Endpoints:
 *   /.well-known/oauth-protected-resource[/api/mcp]  RFC 9728
 *   /.well-known/oauth-authorization-server          RFC 8414
 *   /oauth/authorize                                 consent page (needs an NextMilestone login)
 *   /api/oauth/authorize                             consent decision (form POST)
 *   /api/oauth/token                                 authorization_code + refresh_token
 *   /api/oauth/register                              RFC 7591 dynamic client registration
 *   /api/oauth/revoke                                RFC 7009
 *
 * The origin comes from OAUTH_ISSUER when set (pin it in production if the
 * app is reachable under several hosts), otherwise from the request
 * (X-Forwarded-Host / Host), so discovery, the issuer and the token audience
 * always match the URL the MCP client was given.
 */
import type { McpScope } from "@/lib/mcp/tokens";

export const MCP_PATH = "/api/mcp";
export const AUTHORIZE_PATH = "/oauth/authorize";
export const TOKEN_PATH = "/api/oauth/token";
export const REGISTER_PATH = "/api/oauth/register";
export const REVOKE_PATH = "/api/oauth/revoke";
export const PRM_PATH = "/.well-known/oauth-protected-resource";

export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 3600;
export const AUTH_CODE_TTL_SECONDS = 300;
/** Consent form must be submitted within this window. */
export const CONSENT_TTL_SECONDS = 600;

export const ACCESS_TOKEN_PREFIX = "orb_at_";
export const REFRESH_TOKEN_PREFIX = "orb_rt_";
export const CLIENT_ID_PREFIX = "orbc_";

// Same values as MCP_SCOPES in lib/mcp/tokens.ts (not imported: that module imports this one).
export const SUPPORTED_SCOPES: readonly McpScope[] = ["read", "write"];

export const SCOPE_DESCRIPTIONS: Record<McpScope, string> = {
	read: "Read your profile, Job Inbox, applications, templates and documents",
	write: "Save new resumes and cover letters, create applications and update their status",
};

function firstHeader(value: string | null): string | null {
	if (!value) return null;
	const v = value.split(",")[0].trim();
	return v || null;
}

/** Host the request was addressed to (X-Forwarded-Host / Host), lowercase. */
export function requestHost(req: Request): string {
	return (firstHeader(req.headers.get("x-forwarded-host")) || req.headers.get("host") || new URL(req.url).host).toLowerCase();
}

/** Public origin of this app as seen by the caller, e.g. https://app.example.com */
export function publicOrigin(req: Request): string {
	const pinned = process.env.OAUTH_ISSUER;
	if (pinned) return pinned.replace(/\/+$/, "");
	const url = new URL(req.url);
	const host = requestHost(req);
	let proto = firstHeader(req.headers.get("x-forwarded-proto"));
	if (!proto) {
		// Behind a TLS-terminating proxy that doesn't set X-Forwarded-Proto the
		// app sees http; public hosts are always served over https in production.
		const loopback = /^(localhost|127\.|\[::1\])/.test(host);
		proto = process.env.NODE_ENV === "production" && !loopback ? "https" : url.protocol.replace(/:$/, "");
	}
	if (proto !== "http" && proto !== "https") proto = "https";
	return `${proto}://${host}`.toLowerCase();
}

export function issuerFor(req: Request): string {
	return publicOrigin(req);
}

/** Canonical resource identifier of the MCP server (RFC 8707 / RFC 9728). */
export function mcpResourceFor(req: Request): string {
	return publicOrigin(req) + MCP_PATH;
}

export function resourceMetadataUrlFor(req: Request): string {
	return publicOrigin(req) + PRM_PATH + MCP_PATH;
}

/**
 * Normalise a resource indicator for comparison: lowercase scheme + host, no
 * trailing slash, no default port. Returns null for anything that is not an
 * absolute http(s) URI without a fragment (RFC 8707 §2).
 */
export function normalizeResource(raw: string | null | undefined): string | null {
	if (!raw) return null;
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		return null;
	}
	if (u.protocol !== "https:" && u.protocol !== "http:") return null;
	if (raw.includes("#")) return null;
	const path = u.pathname.replace(/\/+$/, "");
	// URL already lowercases scheme + host and drops a default port.
	return `${u.protocol}//${u.host}${path}${u.search}`;
}

/**
 * Resource values accepted for this server: the MCP endpoint itself, or the
 * bare origin (some clients send the origin of the server URL).
 */
export function acceptedResources(req: Request): string[] {
	const origin = publicOrigin(req);
	return [normalizeResource(origin + MCP_PATH)!, normalizeResource(origin)!];
}

/**
 * Parse a space-separated scope string. Unknown scopes (e.g. "openid",
 * "offline_access") are ignored; write implies read; nothing known ⇒ all.
 */
export function parseScopes(raw: string | null | undefined): McpScope[] {
	const requested = (raw || "").split(/\s+/).filter(Boolean);
	const known = SUPPORTED_SCOPES.filter((s) => requested.includes(s));
	if (!known.length) return [...SUPPORTED_SCOPES];
	if (known.includes("write") && !known.includes("read")) known.unshift("read");
	return known;
}

export function scopeString(scopes: readonly string[]): string {
	return scopes.join(" ");
}
