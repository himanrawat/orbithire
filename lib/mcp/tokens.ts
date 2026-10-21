/**
 * Server-only: bearer authentication for /api/mcp.
 *
 * Two kinds of bearer token are accepted:
 *  - Personal access tokens (Phase 4): "orb_" + 43 chars of base64url (32
 *    random bytes). Only the SHA-256 hex of the full token is stored
 *    (mcp_tokens.token_hash); the first characters (token_prefix) are kept so
 *    the UI can tell tokens apart.
 *  - OAuth 2.1 access tokens (Phase 5): "orb_at_…", issued by the built-in
 *    authorization server (lib/oauth) to claude.ai / ChatGPT connectors,
 *    1 h lifetime, audience-bound to this server's /api/mcp URL (RFC 8707).
 */
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCESS_TOKEN_PREFIX } from "@/lib/oauth/config";
import { touchGrant, verifyAccessToken } from "@/lib/oauth/grants";

export const TOKEN_PREFIX = "orb_";
export const MCP_SCOPES = ["read", "write"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

/** Characters of the token shown in the UI (e.g. "orb_AbC1dE2f"). */
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 8;
const TOKEN_RE = /^orb_[A-Za-z0-9_-]{43}$/;

export function generateToken(): { token: string; hash: string; prefix: string } {
	const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
	return { token, hash: hashToken(token), prefix: token.slice(0, DISPLAY_PREFIX_LENGTH) };
}

export function hashToken(token: string): string {
	return createHash("sha256").update(token, "utf8").digest("hex");
}

export function looksLikeToken(token: string): boolean {
	return TOKEN_RE.test(token);
}

export function normalizeScopes(input: unknown): McpScope[] {
	const list = Array.isArray(input) ? input : [];
	const out = MCP_SCOPES.filter((s) => list.includes(s));
	// write implies read: a write-only token could not look up the ids it writes against.
	if (out.includes("write") && !out.includes("read")) out.unshift("read");
	return out;
}

export interface McpAuth {
	/** "pat" = personal access token, "oauth" = OAuth access token. */
	kind: "pat" | "oauth";
	/** mcp_tokens.id for PATs, oauth_grants.id for OAuth (stable across refreshes). */
	tokenId: string;
	userId: string;
	scopes: McpScope[];
	lastClient: string | null;
	lastUsedAt: string | null;
	/** OAuth only: registered client name (e.g. "Claude", "ChatGPT"). */
	clientName?: string | null;
}

export type BearerResult =
	| { ok: true; auth: McpAuth }
	| { ok: false; error: "missing_token" | "invalid_token"; description: string };

export interface VerifyOptions {
	/**
	 * Normalised resource identifiers this server answers to (RFC 8707). OAuth
	 * tokens issued for anything else are rejected. Required for OAuth tokens.
	 */
	audiences?: string[];
}

/**
 * Parse `Authorization: Bearer …` and look the token up (service-role
 * client): an OAuth access token (orb_at_…) or a personal access token (orb_…).
 */
export async function verifyBearer(
	service: SupabaseClient,
	authorization: string | null,
	options: VerifyOptions = {}
): Promise<BearerResult> {
	const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
	if (!match) {
		return {
			ok: false,
			error: "missing_token",
			description: "Send an OrbitHire access token: Authorization: Bearer orb_… (create one in Settings → AI connections)",
		};
	}
	const token = match[1];
	if (token.startsWith(ACCESS_TOKEN_PREFIX)) {
		const result = await verifyAccessToken(service, token, options.audiences ?? []);
		if (!result.ok) return { ok: false, error: "invalid_token", description: result.description };
		const t = result.token;
		return {
			ok: true,
			auth: {
				kind: "oauth",
				tokenId: t.grantId,
				userId: t.userId,
				scopes: t.scopes,
				lastClient: t.lastClient,
				lastUsedAt: t.lastUsedAt,
				clientName: t.clientName,
			},
		};
	}
	if (!looksLikeToken(token)) {
		return { ok: false, error: "invalid_token", description: "Malformed access token" };
	}
	const { data, error } = await service
		.from("mcp_tokens")
		.select("id, user_id, scopes, revoked_at, last_used_at, last_client")
		.eq("token_hash", hashToken(token))
		.maybeSingle();
	if (error) {
		console.error("[mcp] token lookup failed:", error.message);
		throw new Error("Token lookup failed");
	}
	if (!data) return { ok: false, error: "invalid_token", description: "Unknown access token" };
	if (data.revoked_at) {
		return { ok: false, error: "invalid_token", description: "This access token has been revoked" };
	}
	return {
		ok: true,
		auth: {
			kind: "pat",
			tokenId: data.id,
			userId: data.user_id,
			scopes: normalizeScopes(data.scopes),
			lastClient: data.last_client ?? null,
			lastUsedAt: data.last_used_at ?? null,
		},
	};
}

/**
 * Bump last_used_at (at most once a minute per token) and remember the MCP
 * client name from an `initialize` request. Best effort, never throws.
 */
export async function touchToken(
	service: SupabaseClient,
	auth: McpAuth,
	clientName: string | null
): Promise<void> {
	const stale = !auth.lastUsedAt || Date.now() - new Date(auth.lastUsedAt).getTime() > 60_000;
	const newClient = clientName && clientName !== auth.lastClient;
	if (!stale && !newClient) return;
	const update: Record<string, unknown> = { last_used_at: new Date().toISOString() };
	if (newClient) update.last_client = clientName;
	if (auth.kind === "oauth") return touchGrant(service, auth.tokenId, auth.userId, update);
	const { error } = await service
		.from("mcp_tokens")
		.update(update)
		.eq("id", auth.tokenId)
		.eq("user_id", auth.userId);
	if (error) console.error("[mcp] token touch failed:", error.message);
}

/**
 * clientInfo.name → resumes.source_client. Known clients collapse to a family
 * name ("claude", "chatgpt"); anything else is kept, sanitized.
 */
export function sourceClientFrom(name: string | null | undefined): string {
	const n = (name || "").toLowerCase().trim();
	if (!n) return "mcp";
	if (n.includes("claude")) return "claude";
	if (n.includes("chatgpt") || n.includes("openai")) return "chatgpt";
	if (n.includes("cursor")) return "cursor";
	return n.replace(/[^a-z0-9._-]+/g, "-").slice(0, 40) || "mcp";
}
