/**
 * OAuth clients: Dynamic Client Registration (RFC 7591) and Client ID
 * Metadata Documents (draft-ietf-oauth-client-id-metadata-document, the
 * registration method the MCP spec recommends; claude.ai uses it).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLIENT_ID_PREFIX } from "./config";
import { randomToken, safeEqual, sha256Hex } from "./crypto";

export type AuthMethod = "none" | "client_secret_post" | "client_secret_basic";

export interface OAuthClient {
	client_id: string;
	client_name: string;
	client_uri: string | null;
	logo_uri: string | null;
	redirect_uris: string[];
	grant_types: string[];
	token_endpoint_auth_method: AuthMethod;
	client_secret_hash: string | null;
	registration_type: "dynamic" | "metadata_document";
	metadata_expires_at: string | null;
}

const CLIENT_COLUMNS =
	"client_id, client_name, client_uri, logo_uri, redirect_uris, grant_types, token_endpoint_auth_method, client_secret_hash, registration_type, metadata_expires_at";

export class ClientError extends Error {
	constructor(
		public code: "invalid_client" | "invalid_redirect_uri" | "invalid_client_metadata" | "invalid_request",
		message: string
	) {
		super(message);
	}
}

const MAX_REDIRECT_URIS = 10;
const SUPPORTED_GRANTS = ["authorization_code", "refresh_token"];

function isLoopbackHost(hostname: string): boolean {
	const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
	return h === "localhost" || h === "127.0.0.1" || h === "::1" || /^127\.\d+\.\d+\.\d+$/.test(h);
}

/**
 * Allowed redirect URIs: https (any host, no fragment), or http on a loopback
 * host (native / CLI clients, RFC 8252 §7.3). Everything else is rejected.
 */
export function validateRedirectUri(raw: unknown): string {
	if (typeof raw !== "string" || !raw || raw.length > 2000) {
		throw new ClientError("invalid_redirect_uri", "redirect_uris must be non-empty strings");
	}
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		throw new ClientError("invalid_redirect_uri", `Invalid redirect URI: ${raw}`);
	}
	if (raw.includes("#")) throw new ClientError("invalid_redirect_uri", "Redirect URIs must not contain a fragment");
	if (u.username || u.password) throw new ClientError("invalid_redirect_uri", "Redirect URIs must not contain credentials");
	if (u.protocol === "https:") return raw;
	if (u.protocol === "http:" && isLoopbackHost(u.hostname)) return raw;
	throw new ClientError(
		"invalid_redirect_uri",
		`Redirect URI must use https (or http on localhost / 127.0.0.1): ${raw}`
	);
}

/**
 * Exact string match, except that a loopback redirect may use any port
 * (RFC 8252 §7.3, OAuth 2.1 §8.4.2): native apps pick a free port at runtime.
 */
export function redirectUriMatches(registered: string[], candidate: string): boolean {
	if (registered.includes(candidate)) return true;
	let c: URL;
	try {
		c = new URL(candidate);
	} catch {
		return false;
	}
	if (c.protocol !== "http:" || !isLoopbackHost(c.hostname)) return false;
	return registered.some((r) => {
		try {
			const u = new URL(r);
			return (
				u.protocol === "http:" &&
				u.hostname === c.hostname &&
				u.pathname === c.pathname &&
				u.search === c.search
			);
		} catch {
			return false;
		}
	});
}

function cleanString(v: unknown, max: number): string | null {
	if (typeof v !== "string") return null;
	const s = v.trim();
	return s ? s.slice(0, max) : null;
}

function cleanHttpsUrl(v: unknown): string | null {
	const s = cleanString(v, 500);
	if (!s) return null;
	try {
		const u = new URL(s);
		return u.protocol === "https:" ? s : null;
	} catch {
		return null;
	}
}

function grantTypes(v: unknown): string[] {
	const list = Array.isArray(v) ? v.filter((g): g is string => typeof g === "string") : [];
	const supported = SUPPORTED_GRANTS.filter((g) => list.includes(g));
	if (!list.length) return ["authorization_code", "refresh_token"];
	if (!supported.includes("authorization_code")) {
		throw new ClientError("invalid_client_metadata", "grant_types must include authorization_code");
	}
	return supported;
}

function redirectUris(v: unknown): string[] {
	if (!Array.isArray(v) || v.length === 0) {
		throw new ClientError("invalid_redirect_uri", "redirect_uris is required");
	}
	if (v.length > MAX_REDIRECT_URIS) {
		throw new ClientError("invalid_redirect_uri", `At most ${MAX_REDIRECT_URIS} redirect_uris`);
	}
	return Array.from(new Set(v.map(validateRedirectUri)));
}

function hostOf(uri: string): string {
	try {
		return new URL(uri).host;
	} catch {
		return uri;
	}
}

// --------------------------------------------------- dynamic registration ---

export interface RegistrationResult {
	response: Record<string, unknown>;
}

/** RFC 7591 §3: validate metadata, store the client, return the registration response. */
export async function registerClient(service: SupabaseClient, body: unknown): Promise<RegistrationResult> {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new ClientError("invalid_client_metadata", "Body must be a JSON object");
	}
	const meta = body as Record<string, unknown>;
	const uris = redirectUris(meta.redirect_uris);
	const grants = grantTypes(meta.grant_types);
	const responseTypes = Array.isArray(meta.response_types) ? meta.response_types : ["code"];
	if (!responseTypes.includes("code")) {
		throw new ClientError("invalid_client_metadata", "response_types must include code");
	}
	// RFC 7591 §2: the default is client_secret_basic when omitted.
	const method = (meta.token_endpoint_auth_method ?? "client_secret_basic") as string;
	if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) {
		throw new ClientError(
			"invalid_client_metadata",
			"token_endpoint_auth_method must be none, client_secret_post or client_secret_basic"
		);
	}
	const clientName = cleanString(meta.client_name, 100) || `MCP client (${hostOf(uris[0])})`;
	const clientId = randomToken(CLIENT_ID_PREFIX, 18);
	const secret = method === "none" ? null : randomToken("orbcs_", 32);
	const row = {
		client_id: clientId,
		client_name: clientName,
		client_uri: cleanHttpsUrl(meta.client_uri),
		logo_uri: cleanHttpsUrl(meta.logo_uri),
		redirect_uris: uris,
		grant_types: grants,
		token_endpoint_auth_method: method,
		client_secret_hash: secret ? sha256Hex(secret) : null,
		registration_type: "dynamic",
		software_id: cleanString(meta.software_id, 200),
		software_version: cleanString(meta.software_version, 50),
	};
	const { data, error } = await service.from("oauth_clients").insert(row).select("created_at").single();
	if (error) {
		console.error("[oauth] client insert failed:", error.message);
		throw new Error("Could not store the client");
	}
	const response: Record<string, unknown> = {
		client_id: clientId,
		client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
		client_name: clientName,
		redirect_uris: uris,
		grant_types: grants,
		response_types: ["code"],
		token_endpoint_auth_method: method,
		scope: "read write",
	};
	if (row.client_uri) response.client_uri = row.client_uri;
	if (row.logo_uri) response.logo_uri = row.logo_uri;
	if (secret) {
		response.client_secret = secret;
		response.client_secret_expires_at = 0;
	}
	return { response };
}

// ------------------------------------------- client id metadata documents ---

const CIMD_MAX_BYTES = 10_000;
const CIMD_TIMEOUT_MS = 5_000;
const CIMD_DEFAULT_TTL_S = 3600;
const CIMD_MIN_TTL_S = 300;
const CIMD_MAX_TTL_S = 24 * 3600;

/** A client_id that is an https URL with a path → Client ID Metadata Document. */
export function isMetadataDocumentClientId(clientId: string): boolean {
	if (!clientId.startsWith("https://")) return false;
	try {
		const u = new URL(clientId);
		return (
			u.protocol === "https:" &&
			u.pathname.length > 1 &&
			!u.hash &&
			!u.username &&
			!u.password &&
			!u.pathname.split("/").some((s) => s === "." || s === "..")
		);
	} catch {
		return false;
	}
}

function isPrivateAddress(ip: string): boolean {
	const v = isIP(ip);
	if (v === 4) {
		const [a, b] = ip.split(".").map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 192 && b === 0) ||
			(a === 198 && (b === 18 || b === 19)) ||
			a >= 224
		);
	}
	if (v === 6) {
		const x = ip.toLowerCase();
		if (x === "::" || x === "::1") return true;
		if (x.startsWith("::ffff:")) return isPrivateAddress(x.slice(7));
		return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
	}
	return true;
}

function cacheTtlSeconds(cacheControl: string | null): number {
	const m = cacheControl?.match(/max-age=(\d+)/i);
	const ttl = m ? Number(m[1]) : CIMD_DEFAULT_TTL_S;
	if (/no-store|no-cache/i.test(cacheControl || "")) return CIMD_MIN_TTL_S;
	return Math.min(CIMD_MAX_TTL_S, Math.max(CIMD_MIN_TTL_S, ttl));
}

/** Fetch + validate a metadata document (SSRF-guarded: public https hosts only). */
async function fetchMetadataDocument(clientId: string): Promise<{ meta: Record<string, unknown>; ttl: number }> {
	const url = new URL(clientId);
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
	if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
		throw new ClientError("invalid_client", "client_id host is not reachable or not public");
	}
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), CIMD_TIMEOUT_MS);
	let res: Response;
	try {
		res = await fetch(clientId, {
			headers: { Accept: "application/json" },
			redirect: "manual",
			signal: ctrl.signal,
			cache: "no-store",
		});
	} catch {
		throw new ClientError("invalid_client", "Could not fetch the client metadata document");
	} finally {
		clearTimeout(timer);
	}
	if (res.status !== 200) {
		throw new ClientError("invalid_client", `Client metadata document returned HTTP ${res.status}`);
	}
	const text = await res.text();
	if (text.length > CIMD_MAX_BYTES) throw new ClientError("invalid_client", "Client metadata document too large");
	let meta: unknown;
	try {
		meta = JSON.parse(text);
	} catch {
		throw new ClientError("invalid_client", "Client metadata document is not valid JSON");
	}
	if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
		throw new ClientError("invalid_client", "Client metadata document must be a JSON object");
	}
	return { meta: meta as Record<string, unknown>, ttl: cacheTtlSeconds(res.headers.get("cache-control")) };
}

async function resolveMetadataDocumentClient(service: SupabaseClient, clientId: string): Promise<OAuthClient> {
	const { meta, ttl } = await fetchMetadataDocument(clientId);
	if (meta.client_id !== clientId) {
		throw new ClientError("invalid_client", "client_id in the metadata document does not match its URL");
	}
	if ("client_secret" in meta || "client_secret_expires_at" in meta) {
		throw new ClientError("invalid_client", "Metadata documents must not contain a client secret");
	}
	const method = (meta.token_endpoint_auth_method ?? "none") as string;
	if (method !== "none") {
		throw new ClientError("invalid_client", "Only public clients (token_endpoint_auth_method none) are supported");
	}
	const uris = redirectUris(meta.redirect_uris);
	const grants = grantTypes(meta.grant_types);
	const row = {
		client_id: clientId,
		client_name: cleanString(meta.client_name, 100) || new URL(clientId).host,
		client_uri: cleanHttpsUrl(meta.client_uri),
		logo_uri: cleanHttpsUrl(meta.logo_uri),
		redirect_uris: uris,
		grant_types: grants,
		token_endpoint_auth_method: "none" as const,
		client_secret_hash: null,
		registration_type: "metadata_document" as const,
		metadata_expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
		software_id: cleanString(meta.software_id, 200),
		software_version: cleanString(meta.software_version, 50),
		updated_at: new Date().toISOString(),
	};
	const { error } = await service.from("oauth_clients").upsert(row, { onConflict: "client_id" });
	if (error) {
		console.error("[oauth] metadata client upsert failed:", error.message);
		throw new Error("Could not store the client");
	}
	return row;
}

/**
 * Look up a client. URL client ids are (re)fetched when not cached or the
 * cache expired; a failed refresh falls back to the cached copy.
 */
export async function getClient(service: SupabaseClient, clientId: string | null): Promise<OAuthClient | null> {
	if (!clientId || clientId.length > 500) return null;
	const { data, error } = await service.from("oauth_clients").select(CLIENT_COLUMNS).eq("client_id", clientId).maybeSingle();
	if (error) {
		console.error("[oauth] client lookup failed:", error.message);
		throw new Error("Client lookup failed");
	}
	const cached = data as OAuthClient | null;
	if (!isMetadataDocumentClientId(clientId)) return cached;
	const fresh = cached?.metadata_expires_at && new Date(cached.metadata_expires_at).getTime() > Date.now();
	if (cached && fresh) return cached;
	try {
		return await resolveMetadataDocumentClient(service, clientId);
	} catch (err) {
		if (cached) return cached;
		throw err;
	}
}

/**
 * Token / revocation endpoint client authentication. Public clients send only
 * client_id; confidential (DCR with a secret) clients must present the secret
 * via HTTP Basic or the request body.
 */
export function authenticateClient(client: OAuthClient, secret: string | null): boolean {
	if (!client.client_secret_hash) return true;
	if (!secret) return false;
	return safeEqual(sha256Hex(secret), client.client_secret_hash);
}

export function redirectHost(uri: string): string {
	return hostOf(uri);
}
