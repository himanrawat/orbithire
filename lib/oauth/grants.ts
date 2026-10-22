/**
 * Server-only: authorization requests, codes, grants and tokens for the
 * NextMilestone OAuth 2.1 server. Everything here uses the service-role client;
 * every secret is stored as a SHA-256 hash.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpScope } from "@/lib/mcp/tokens";
import {
	ACCESS_TOKEN_PREFIX,
	ACCESS_TOKEN_TTL_SECONDS,
	AUTH_CODE_TTL_SECONDS,
	REFRESH_TOKEN_PREFIX,
	REFRESH_TOKEN_TTL_SECONDS,
	SUPPORTED_SCOPES,
	acceptedResources,
	mcpResourceFor,
	normalizeResource,
	parseScopes,
	scopeString,
} from "./config";
import { isValidCodeChallenge, randomToken, sha256Hex, verifyPkceS256 } from "./crypto";
import { ClientError, getClient, redirectHost, redirectUriMatches, type OAuthClient } from "./clients";

// ------------------------------------------------- authorization request ---

/** A validated authorization request (what the consent form carries, signed). */
export interface AuthorizationRequest {
	client_id: string;
	redirect_uri: string;
	code_challenge: string;
	scopes: McpScope[];
	resource: string;
	state: string | null;
}

export type AuthorizeValidation =
	| { ok: true; request: AuthorizationRequest; client: OAuthClient }
	/** Client or redirect URI unusable: show the error, never redirect. */
	| { ok: false; kind: "render"; title: string; message: string }
	/** Everything else: report back to the client's redirect URI. */
	| { ok: false; kind: "redirect"; location: string };

/** Build the redirect back to the client (RFC 6749 §4.1.2 + RFC 9207 `iss`). */
export function clientRedirect(redirectUri: string, params: Record<string, string | null | undefined>): string {
	const u = new URL(redirectUri);
	for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
	return u.toString();
}

export async function validateAuthorizationRequest(
	service: SupabaseClient,
	req: Request,
	params: URLSearchParams,
	issuer: string
): Promise<AuthorizeValidation> {
	const clientId = params.get("client_id");
	if (!clientId) return { ok: false, kind: "render", title: "Invalid request", message: "client_id is missing." };
	let client: OAuthClient | null;
	try {
		client = await getClient(service, clientId);
	} catch (err) {
		const message = err instanceof ClientError ? err.message : "Could not look up the application.";
		return { ok: false, kind: "render", title: "Unknown application", message };
	}
	if (!client) {
		return {
			ok: false,
			kind: "render",
			title: "Unknown application",
			message: "This application is not registered with NextMilestone. Remove the connector and add it again.",
		};
	}
	let redirectUri = params.get("redirect_uri");
	if (!redirectUri && client.redirect_uris.length === 1) redirectUri = client.redirect_uris[0];
	if (!redirectUri || !redirectUriMatches(client.redirect_uris, redirectUri)) {
		return {
			ok: false,
			kind: "render",
			title: "Invalid redirect",
			message: "The redirect URI does not match the ones registered for this application.",
		};
	}
	const state = params.get("state");
	const fail = (error: string, description: string): AuthorizeValidation => ({
		ok: false,
		kind: "redirect",
		location: clientRedirect(redirectUri!, { error, error_description: description, state, iss: issuer }),
	});

	if (params.get("response_type") !== "code") {
		return fail("unsupported_response_type", "Only response_type=code is supported");
	}
	const challenge = params.get("code_challenge");
	if (!challenge || !isValidCodeChallenge(challenge)) {
		return fail("invalid_request", "PKCE is required: send code_challenge (S256)");
	}
	if (params.get("code_challenge_method") !== "S256") {
		return fail("invalid_request", "code_challenge_method must be S256");
	}
	const resources = params.getAll("resource");
	if (resources.length > 1) return fail("invalid_target", "Send a single resource parameter");
	let resource = mcpResourceFor(req);
	if (resources.length === 1) {
		const normalized = normalizeResource(resources[0]);
		if (!normalized || !acceptedResources(req).includes(normalized)) {
			return fail("invalid_target", `Unknown resource; use ${mcpResourceFor(req)}`);
		}
		resource = normalized;
	}
	return {
		ok: true,
		client,
		request: {
			client_id: client.client_id,
			redirect_uri: redirectUri,
			code_challenge: challenge,
			scopes: parseScopes(params.get("scope")),
			resource,
			state,
		},
	};
}

/** User approved: store the grant + a single-use code, return the code. */
export async function createAuthorizationCode(
	service: SupabaseClient,
	userId: string,
	client: Pick<OAuthClient, "client_id" | "client_name">,
	request: AuthorizationRequest,
	scopes: McpScope[]
): Promise<string> {
	const { data: grant, error: grantErr } = await service
		.from("oauth_grants")
		.insert({
			user_id: userId,
			client_id: client.client_id,
			client_name: client.client_name,
			redirect_host: redirectHost(request.redirect_uri),
			scopes,
			resource: request.resource,
		})
		.select("id")
		.single();
	if (grantErr) throw new Error(`grant insert failed: ${grantErr.message}`);
	const code = randomToken("", 32);
	const { error } = await service.from("oauth_authorization_codes").insert({
		code_hash: sha256Hex(code),
		grant_id: grant.id,
		client_id: client.client_id,
		user_id: userId,
		redirect_uri: request.redirect_uri,
		code_challenge: request.code_challenge,
		scopes,
		resource: request.resource,
		expires_at: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
	});
	if (error) throw new Error(`code insert failed: ${error.message}`);
	return code;
}

// ---------------------------------------------------------------- tokens ---

export interface TokenResponse {
	access_token: string;
	token_type: "Bearer";
	expires_in: number;
	refresh_token: string;
	scope: string;
}

export class GrantError extends Error {
	constructor(
		public code: "invalid_grant" | "invalid_request" | "invalid_scope" | "invalid_target" | "invalid_client",
		message: string
	) {
		super(message);
	}
}

async function issueTokens(
	service: SupabaseClient,
	grantId: string,
	scopes: string[],
	resource: string
): Promise<TokenResponse> {
	const access = randomToken(ACCESS_TOKEN_PREFIX, 32);
	const refresh = randomToken(REFRESH_TOKEN_PREFIX, 32);
	const now = Date.now();
	const { error } = await service.from("oauth_tokens").insert([
		{
			grant_id: grantId,
			kind: "access",
			token_hash: sha256Hex(access),
			scopes,
			resource,
			expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
		},
		{
			grant_id: grantId,
			kind: "refresh",
			token_hash: sha256Hex(refresh),
			scopes,
			resource,
			expires_at: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
		},
	]);
	if (error) throw new Error(`token insert failed: ${error.message}`);
	if (Math.random() < 0.02) void service.rpc("oauth_cleanup_expired").then(() => {}, () => {});
	return {
		access_token: access,
		token_type: "Bearer",
		expires_in: ACCESS_TOKEN_TTL_SECONDS,
		refresh_token: refresh,
		scope: scopeString(scopes),
	};
}

/** Revoke a grant and every token issued under it. */
export async function revokeGrant(service: SupabaseClient, grantId: string): Promise<void> {
	const now = new Date().toISOString();
	const g = await service.from("oauth_grants").update({ revoked_at: now }).eq("id", grantId).is("revoked_at", null);
	if (g.error) throw new Error(`grant revoke failed: ${g.error.message}`);
	const t = await service.from("oauth_tokens").update({ revoked_at: now }).eq("grant_id", grantId).is("revoked_at", null);
	if (t.error) throw new Error(`token revoke failed: ${t.error.message}`);
}

function checkResourceParam(params: URLSearchParams, expected: string) {
	const resources = params.getAll("resource");
	if (resources.length > 1) throw new GrantError("invalid_target", "Send a single resource parameter");
	if (resources.length === 1 && normalizeResource(resources[0]) !== expected) {
		throw new GrantError("invalid_target", "resource does not match the authorization");
	}
}

/** grant_type=authorization_code (OAuth 2.1 §4.1.3) with PKCE. */
export async function exchangeAuthorizationCode(
	service: SupabaseClient,
	client: OAuthClient,
	params: URLSearchParams
): Promise<TokenResponse> {
	const code = params.get("code");
	const verifier = params.get("code_verifier");
	if (!code) throw new GrantError("invalid_request", "code is required");
	if (!verifier) throw new GrantError("invalid_request", "code_verifier is required (PKCE)");
	const codeHash = sha256Hex(code);
	const { data: row, error } = await service
		.from("oauth_authorization_codes")
		.select("code_hash, grant_id, client_id, redirect_uri, code_challenge, scopes, resource, expires_at, used_at")
		.eq("code_hash", codeHash)
		.maybeSingle();
	if (error) throw new Error(`code lookup failed: ${error.message}`);
	if (!row) throw new GrantError("invalid_grant", "Unknown authorization code");
	if (row.used_at) {
		// Code replay: per OAuth 2.1 §4.1.3, revoke what was issued with it.
		await revokeGrant(service, row.grant_id);
		throw new GrantError("invalid_grant", "Authorization code already used");
	}
	if (new Date(row.expires_at).getTime() < Date.now()) throw new GrantError("invalid_grant", "Authorization code expired");
	if (row.client_id !== client.client_id) throw new GrantError("invalid_grant", "Code was issued to another client");
	const redirectUri = params.get("redirect_uri");
	if (redirectUri !== null && redirectUri !== row.redirect_uri) {
		throw new GrantError("invalid_grant", "redirect_uri does not match the authorization request");
	}
	if (!verifyPkceS256(verifier, row.code_challenge)) throw new GrantError("invalid_grant", "PKCE verification failed");
	checkResourceParam(params, row.resource);

	// Single use: only the request that flips used_at gets tokens.
	const { data: claimed, error: claimErr } = await service
		.from("oauth_authorization_codes")
		.update({ used_at: new Date().toISOString() })
		.eq("code_hash", codeHash)
		.is("used_at", null)
		.select("code_hash");
	if (claimErr) throw new Error(`code claim failed: ${claimErr.message}`);
	if (!claimed?.length) {
		await revokeGrant(service, row.grant_id);
		throw new GrantError("invalid_grant", "Authorization code already used");
	}
	const { data: grant } = await service.from("oauth_grants").select("revoked_at").eq("id", row.grant_id).maybeSingle();
	if (!grant || grant.revoked_at) throw new GrantError("invalid_grant", "Authorization was revoked");
	return issueTokens(service, row.grant_id, row.scopes, row.resource);
}

/** Concurrent refreshes within this window don't count as token replay. */
const REFRESH_REUSE_GRACE_MS = 30_000;

/** grant_type=refresh_token with rotation (OAuth 2.1 §4.3.1, §4.3.3). */
export async function exchangeRefreshToken(
	service: SupabaseClient,
	client: OAuthClient,
	params: URLSearchParams
): Promise<TokenResponse> {
	const token = params.get("refresh_token");
	if (!token) throw new GrantError("invalid_request", "refresh_token is required");
	const hash = sha256Hex(token);
	const { data: row, error } = await service
		.from("oauth_tokens")
		.select("id, grant_id, kind, scopes, resource, expires_at, rotated_at, revoked_at, oauth_grants!inner(client_id, revoked_at)")
		.eq("token_hash", hash)
		.maybeSingle();
	if (error) throw new Error(`refresh lookup failed: ${error.message}`);
	if (!row || row.kind !== "refresh") throw new GrantError("invalid_grant", "Unknown refresh token");
	const grant = row.oauth_grants as unknown as { client_id: string; revoked_at: string | null };
	if (grant.client_id !== client.client_id) throw new GrantError("invalid_grant", "Refresh token was issued to another client");
	if (row.revoked_at || grant.revoked_at) throw new GrantError("invalid_grant", "Refresh token revoked");
	if (row.rotated_at) {
		if (Date.now() - new Date(row.rotated_at).getTime() > REFRESH_REUSE_GRACE_MS) {
			await revokeGrant(service, row.grant_id);
		}
		throw new GrantError("invalid_grant", "Refresh token already used");
	}
	if (new Date(row.expires_at).getTime() < Date.now()) throw new GrantError("invalid_grant", "Refresh token expired");
	checkResourceParam(params, row.resource);

	let scopes: string[] = row.scopes;
	const requested = params.get("scope");
	if (requested) {
		// Unknown scopes (offline_access, openid, …) are ignored, as at /oauth/authorize.
		const asked = requested.split(/\s+/).filter((s) => (SUPPORTED_SCOPES as readonly string[]).includes(s));
		if (asked.some((s) => !row.scopes.includes(s))) {
			throw new GrantError("invalid_scope", "Requested scope exceeds the original grant");
		}
		if (asked.length) scopes = parseScopes(asked.join(" "));
	}

	const { data: claimed, error: claimErr } = await service
		.from("oauth_tokens")
		.update({ rotated_at: new Date().toISOString() })
		.eq("id", row.id)
		.is("rotated_at", null)
		.select("id");
	if (claimErr) throw new Error(`refresh claim failed: ${claimErr.message}`);
	if (!claimed?.length) throw new GrantError("invalid_grant", "Refresh token already used");
	return issueTokens(service, row.grant_id, scopes, row.resource);
}

/**
 * RFC 7009 revocation. Refresh token ⇒ the whole grant; access token ⇒ that
 * token. Unknown tokens and tokens of other clients are silently ignored.
 */
export async function revokeToken(service: SupabaseClient, client: OAuthClient, token: string): Promise<void> {
	const { data: row } = await service
		.from("oauth_tokens")
		.select("id, grant_id, kind, oauth_grants!inner(client_id)")
		.eq("token_hash", sha256Hex(token))
		.maybeSingle();
	if (!row) return;
	const grant = row.oauth_grants as unknown as { client_id: string };
	if (grant.client_id !== client.client_id) return;
	if (row.kind === "refresh") {
		await revokeGrant(service, row.grant_id);
	} else {
		await service.from("oauth_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", row.id).is("revoked_at", null);
	}
}

// ------------------------------------------------- resource server side ---

export interface VerifiedAccessToken {
	grantId: string;
	userId: string;
	scopes: McpScope[];
	clientName: string;
	lastClient: string | null;
	lastUsedAt: string | null;
}

export type AccessTokenResult =
	| { ok: true; token: VerifiedAccessToken }
	| { ok: false; description: string };

/**
 * Validate an OAuth access token for /api/mcp: known, not expired, not
 * revoked (token or grant) and issued for one of `audiences` (RFC 8707).
 */
export async function verifyAccessToken(
	service: SupabaseClient,
	token: string,
	audiences: string[]
): Promise<AccessTokenResult> {
	if (!token.startsWith(ACCESS_TOKEN_PREFIX) || token.length > 200) {
		return { ok: false, description: "Malformed access token" };
	}
	const { data, error } = await service
		.from("oauth_tokens")
		.select(
			"kind, scopes, resource, expires_at, revoked_at, grant_id, oauth_grants!inner(user_id, client_name, revoked_at, last_used_at, last_client)"
		)
		.eq("token_hash", sha256Hex(token))
		.maybeSingle();
	if (error) throw new Error(`access token lookup failed: ${error.message}`);
	if (!data || data.kind !== "access") return { ok: false, description: "Unknown access token" };
	const grant = data.oauth_grants as unknown as {
		user_id: string;
		client_name: string;
		revoked_at: string | null;
		last_used_at: string | null;
		last_client: string | null;
	};
	if (data.revoked_at || grant.revoked_at) return { ok: false, description: "This access token has been revoked" };
	if (new Date(data.expires_at).getTime() <= Date.now()) return { ok: false, description: "The access token expired" };
	if (!audiences.includes(data.resource)) {
		return { ok: false, description: "The access token was issued for a different resource" };
	}
	return {
		ok: true,
		token: {
			grantId: data.grant_id,
			userId: grant.user_id,
			scopes: SUPPORTED_SCOPES.filter((s) => (data.scopes as string[]).includes(s)),
			clientName: grant.client_name,
			lastClient: grant.last_client,
			lastUsedAt: grant.last_used_at,
		},
	};
}

/** Settings → AI connections: bump last_used_at / last_client on a grant. */
export async function touchGrant(
	service: SupabaseClient,
	grantId: string,
	userId: string,
	update: Record<string, unknown>
): Promise<void> {
	const { error } = await service.from("oauth_grants").update(update).eq("id", grantId).eq("user_id", userId);
	if (error) console.error("[oauth] grant touch failed:", error.message);
}
