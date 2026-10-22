/**
 * End-to-end test for the MCP OAuth 2.1 server (Phase 5).
 *
 * Plays the part of claude.ai / ChatGPT against a running app: discovery from
 * a 401 → registration (DCR and Client ID Metadata Document) → login + consent
 * (via the consent page's own HTTP calls) → PKCE token exchange → MCP calls →
 * refresh rotation → revocation, plus negative cases. It also runs the
 * official MCP SDK client's OAuth flow (auth provider) end to end.
 *
 *   OAUTH_BASE=http://localhost:3117 \
 *     npx ts-node --transpile-only --project tsconfig.scripts.json scripts/oauth-smoke.ts
 *
 * Env (from .env.local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY. Login: OAUTH_SMOKE_EMAIL / OAUTH_SMOKE_PASSWORD
 * (default test@orbithire.local / Test@12345). Cleans up every client/grant it
 * created. Set OAUTH_SMOKE_CIMD=0 to skip the claude.ai metadata-document test
 * (needs internet). Never point this at production.
 */
import { config as loadEnv } from "dotenv";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
	OAuthClientInformationMixed,
	OAuthClientMetadata,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

loadEnv({ path: ".env.local" });

const BASE = (process.env.OAUTH_BASE || "http://localhost:3000").replace(/\/+$/, "");
const MCP_URL = `${BASE}/api/mcp`;
const EMAIL = process.env.OAUTH_SMOKE_EMAIL || "test@orbithire.local";
const PASSWORD = process.env.OAUTH_SMOKE_PASSWORD || "Test@12345";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RUN_CIMD = process.env.OAUTH_SMOKE_CIMD !== "0";

const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const CHATGPT_CALLBACK = "https://chatgpt.com/connector_platform_oauth_redirect";
const CLAUDE_CIMD = "https://claude.ai/oauth/mcp-oauth-client-metadata";

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
	console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY");
	process.exit(2);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
	console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` – ${detail}` : ""}`);
	if (!cond) failures++;
}

const createdClients = new Set<string>();
const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");

function pkce() {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

// ------------------------------------------------------------- session ---

/** Log in with the Supabase password grant and build the app's auth cookies. */
async function sessionCookie(): Promise<string> {
	const jar = new Map<string, string>();
	const supabase = createServerClient(SUPABASE_URL, ANON_KEY, {
		cookies: {
			getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
			setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
		},
	});
	const { error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
	if (error) throw new Error(`login failed: ${error.message}`);
	return Array.from(jar, ([n, v]) => `${n}=${v}`).join("; ");
}

// ---------------------------------------------------------------- http ---

async function form(path: string, body: Record<string, string>, headers: Record<string, string> = {}) {
	const res = await fetch(BASE + path, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
		body: new URLSearchParams(body).toString(),
		redirect: "manual",
	});
	const text = await res.text();
	let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
	try {
		json = JSON.parse(text);
	} catch {
		/* not json */
	}
	return { status: res.status, json, text, headers: res.headers };
}

async function register(meta: Record<string, unknown>) {
	const res = await fetch(`${BASE}/api/oauth/register`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(meta),
	});
	const json = (await res.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	if (json.client_id) createdClients.add(json.client_id);
	return { status: res.status, json };
}

function authorizeUrl(p: Record<string, string | undefined>): string {
	const u = new URL(`${BASE}/oauth/authorize`);
	for (const [k, v] of Object.entries(p)) if (v !== undefined) u.searchParams.set(k, v);
	return u.toString();
}

/** Open the consent page as the logged-in user and submit it like the browser would. */
async function consent(url: string, cookie: string, opts: { decision?: "approve" | "deny"; write?: boolean; origin?: string } = {}) {
	const page = await fetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
	const html = await page.text();
	const m = html.match(/name="consent" value="([^"]+)"/);
	if (!m) return { pageStatus: page.status, location: page.headers.get("location"), html, status: 0, redirect: null as URL | null };
	const fields: Record<string, string> = { consent: m[1], decision: opts.decision || "approve" };
	if (opts.write !== false && /name="scope_write"/.test(html)) fields.scope_write = "1";
	const res = await fetch(`${BASE}/api/oauth/authorize`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Cookie: cookie,
			Origin: opts.origin || BASE,
		},
		body: new URLSearchParams(fields).toString(),
		redirect: "manual",
	});
	const loc = res.headers.get("location");
	return { pageStatus: page.status, location: loc, html, status: res.status, redirect: loc ? new URL(loc) : null };
}

async function mcpStatus(token: string): Promise<{ status: number; www: string }> {
	const res = await fetch(MCP_URL, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
	});
	await res.text();
	return { status: res.status, www: res.headers.get("www-authenticate") || "" };
}

async function mcpClient(token: string) {
	const client = new Client({ name: "claude-ai", version: "oauth-smoke" });
	await client.connect(
		new StreamableHTTPClientTransport(new URL(MCP_URL), {
			requestInit: { headers: { Authorization: `Bearer ${token}` } },
		})
	);
	return client;
}

/** Full authorization for a client, returns tokens. */
async function authorizeAndExchange(
	cookie: string,
	clientId: string,
	redirectUri: string,
	extra: { scope?: string; write?: boolean } = {}
) {
	const { verifier, challenge } = pkce();
	const state = randomBytes(8).toString("hex");
	const c = await consent(
		authorizeUrl({
			response_type: "code",
			client_id: clientId,
			redirect_uri: redirectUri,
			code_challenge: challenge,
			code_challenge_method: "S256",
			scope: extra.scope ?? "read write",
			state,
			resource: MCP_URL,
		}),
		cookie,
		{ write: extra.write }
	);
	const code = c.redirect?.searchParams.get("code") || "";
	const tok = await form("/api/oauth/token", {
		grant_type: "authorization_code",
		code,
		code_verifier: verifier,
		client_id: clientId,
		redirect_uri: redirectUri,
		resource: MCP_URL,
	});
	return { consent: c, code, verifier, state, tok };
}

// ------------------------------------------------------------- SDK flow ---

class SmokeProvider implements OAuthClientProvider {
	info?: OAuthClientInformationMixed;
	saved?: OAuthTokens;
	verifier = "";
	capturedCode: string | null = null;
	capturedUrl: URL | null = null;
	constructor(private cookie: string, private redirect: string, public clientMetadataUrl?: string) {}
	get redirectUrl() {
		return this.redirect;
	}
	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: "NextMilestone OAuth smoke (SDK)",
			redirect_uris: [this.redirect],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		};
	}
	clientInformation() {
		return this.info;
	}
	saveClientInformation(info: OAuthClientInformationMixed) {
		this.info = info;
		if (info.client_id && !info.client_id.startsWith("https://")) createdClients.add(info.client_id);
	}
	tokens() {
		return this.saved;
	}
	saveTokens(t: OAuthTokens) {
		this.saved = t;
	}
	async redirectToAuthorization(url: URL) {
		this.capturedUrl = url;
		const c = await consent(url.toString(), this.cookie);
		this.capturedCode = c.redirect?.searchParams.get("code") ?? null;
	}
	saveCodeVerifier(v: string) {
		this.verifier = v;
	}
	codeVerifier() {
		return this.verifier;
	}
}

async function sdkFlow(cookie: string, label: string, redirect: string, metadataUrl?: string) {
	const provider = new SmokeProvider(cookie, redirect, metadataUrl);
	const first = new Client({ name: "claude-ai", version: "oauth-smoke" });
	let needsAuth = false;
	try {
		await first.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider: provider }));
	} catch (err) {
		needsAuth = err instanceof UnauthorizedError;
	}
	check(`${label}: SDK hits 401 and starts OAuth`, needsAuth && !!provider.capturedUrl);
	const au = provider.capturedUrl;
	check(
		`${label}: SDK authorize URL has PKCE S256 + resource`,
		!!au && au.searchParams.get("code_challenge_method") === "S256" && au.searchParams.get("resource") === MCP_URL,
		au ? `client_id=${au.searchParams.get("client_id")} scope=${au.searchParams.get("scope")}` : ""
	);
	if (metadataUrl) check(`${label}: SDK used the metadata document client_id`, au?.searchParams.get("client_id") === metadataUrl);
	check(`${label}: consent returned a code`, !!provider.capturedCode);
	const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider: provider });
	await transport.finishAuth(provider.capturedCode || "");
	check(`${label}: SDK exchanged the code`, !!provider.saved?.access_token?.startsWith("orb_at_"), `scope=${provider.saved?.scope}`);
	const client = new Client({ name: "claude-ai", version: "oauth-smoke" });
	await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL), { authProvider: provider }));
	const tools = await client.listTools();
	check(`${label}: tools/list over OAuth`, tools.tools.length > 5, `${tools.tools.length} tools`);
	await client.close();
	return provider;
}

// ----------------------------------------------------------------- main ---

async function main() {
	console.log(`OAuth smoke against ${BASE}`);

	// 1. Discovery from a 401 ------------------------------------------------
	const unauth = await fetch(MCP_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
	});
	const www = unauth.headers.get("www-authenticate") || "";
	const prmUrl = www.match(/resource_metadata="([^"]+)"/)?.[1] || "";
	check("401 carries resource_metadata + scope", unauth.status === 401 && !!prmUrl && /scope="read write"/.test(www), www);
	const prm = (await (await fetch(prmUrl)).json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	check("PRM (path-suffixed) resource = MCP URL", prm.resource === MCP_URL, prm.resource);
	const prmRoot = (await (await fetch(`${BASE}/.well-known/oauth-protected-resource`)).json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	check("PRM (root) served too", prmRoot.resource === MCP_URL && prmRoot.authorization_servers?.[0] === prm.authorization_servers?.[0]);
	const issuer: string = prm.authorization_servers?.[0];
	const asm = (await (await fetch(`${issuer}/.well-known/oauth-authorization-server`)).json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	check("AS metadata issuer matches", asm.issuer === issuer, asm.issuer);
	check(
		"AS metadata: S256, CIMD, DCR, revocation, iss param",
		asm.code_challenge_methods_supported?.includes("S256") &&
			asm.client_id_metadata_document_supported === true &&
			!!asm.registration_endpoint &&
			!!asm.revocation_endpoint &&
			asm.authorization_response_iss_parameter_supported === true
	);

	// 2. Dynamic client registration ----------------------------------------
	const reg = await register({
		client_name: "OAuth smoke (DCR)",
		redirect_uris: [CLAUDE_CALLBACK, CHATGPT_CALLBACK, "http://localhost:6274/oauth/callback"],
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		token_endpoint_auth_method: "none",
	});
	check("DCR: public client registered", reg.status === 201 && !!reg.json.client_id && !reg.json.client_secret, reg.json.client_id);
	const clientId: string = reg.json.client_id;
	const badReg = await register({ client_name: "bad", redirect_uris: ["http://evil.example/cb"], token_endpoint_auth_method: "none" });
	check("DCR: plain-http non-localhost redirect rejected", badReg.status === 400 && badReg.json.error === "invalid_redirect_uri");
	const badReg2 = await register({ client_name: "bad", redirect_uris: ["javascript:alert(1)"], token_endpoint_auth_method: "none" });
	check("DCR: javascript: redirect rejected", badReg2.status === 400);
	const noReg = await register({ client_name: "bad", token_endpoint_auth_method: "none" });
	check("DCR: missing redirect_uris rejected", noReg.status === 400);

	// 3. Login + authorize ---------------------------------------------------
	const cookie = await sessionCookie();
	const { verifier, challenge } = pkce();
	const state = "st-" + randomBytes(6).toString("hex");
	const authParams = {
		response_type: "code",
		client_id: clientId,
		redirect_uri: CLAUDE_CALLBACK,
		code_challenge: challenge,
		code_challenge_method: "S256",
		scope: "read write",
		state,
		resource: MCP_URL,
	};
	const anon = await fetch(authorizeUrl(authParams), { redirect: "manual" });
	const anonLoc = anon.headers.get("location") || "";
	check("authorize without login → /signin?redirect=…", anon.status >= 300 && anon.status < 400 && anonLoc.includes("/signin?redirect=%2Foauth%2Fauthorize"), anonLoc.slice(0, 80));

	const badRedirect = await fetch(authorizeUrl({ ...authParams, redirect_uri: "https://evil.example/cb" }), {
		headers: { Cookie: cookie },
		redirect: "manual",
	});
	const badRedirectHtml = await badRedirect.text();
	check("authorize: unregistered redirect_uri → error page, no redirect", badRedirect.status === 200 && /Invalid redirect/.test(badRedirectHtml));
	const badTarget = await fetch(authorizeUrl({ ...authParams, resource: "https://other.example/mcp" }), { headers: { Cookie: cookie }, redirect: "manual" });
	const badTargetLoc = new URL(badTarget.headers.get("location") || "http://x/");
	check(
		"authorize: wrong resource → invalid_target redirect with state + iss",
		badTargetLoc.searchParams.get("error") === "invalid_target" && badTargetLoc.searchParams.get("state") === state && badTargetLoc.searchParams.get("iss") === issuer
	);
	const noPkce = await fetch(authorizeUrl({ ...authParams, code_challenge: undefined, code_challenge_method: undefined }), { headers: { Cookie: cookie }, redirect: "manual" });
	check("authorize: missing PKCE → invalid_request", new URL(noPkce.headers.get("location") || "http://x/").searchParams.get("error") === "invalid_request");
	const plainPkce = await fetch(authorizeUrl({ ...authParams, code_challenge_method: "plain" }), { headers: { Cookie: cookie }, redirect: "manual" });
	check("authorize: plain PKCE rejected", new URL(plainPkce.headers.get("location") || "http://x/").searchParams.get("error") === "invalid_request");

	const csrf = await consent(authorizeUrl(authParams), cookie, { origin: "https://evil.example" });
	check("consent POST from another origin → 403", csrf.status === 403);
	const denied = await consent(authorizeUrl(authParams), cookie, { decision: "deny" });
	check("consent deny → access_denied", denied.redirect?.searchParams.get("error") === "access_denied" && denied.redirect?.searchParams.get("state") === state);

	const c = await consent(authorizeUrl(authParams), cookie);
	check("consent page shows client + scopes", c.pageStatus === 200 && c.html.includes("OAuth smoke (DCR)") && c.html.includes("claude.ai") && /write/.test(c.html));
	const code = c.redirect?.searchParams.get("code") || "";
	check(
		"approve → 303 to redirect_uri with code, state, iss",
		c.status === 303 && c.redirect?.origin + (c.redirect?.pathname || "") === CLAUDE_CALLBACK && !!code && c.redirect?.searchParams.get("state") === state && c.redirect?.searchParams.get("iss") === issuer
	);

	// 4. Token exchange (+ negatives) ---------------------------------------
	const tokenBody = { grant_type: "authorization_code", code, code_verifier: verifier, client_id: clientId, redirect_uri: CLAUDE_CALLBACK, resource: MCP_URL };
	const wrongVerifier = await form("/api/oauth/token", { ...tokenBody, code_verifier: pkce().verifier });
	check("token: wrong code_verifier → invalid_grant", wrongVerifier.status === 400 && wrongVerifier.json?.error === "invalid_grant");
	const wrongRedirect = await form("/api/oauth/token", { ...tokenBody, redirect_uri: CHATGPT_CALLBACK });
	check("token: wrong redirect_uri → invalid_grant", wrongRedirect.json?.error === "invalid_grant");
	const wrongResource = await form("/api/oauth/token", { ...tokenBody, resource: "https://other.example/mcp" });
	check("token: wrong resource → invalid_target", wrongResource.json?.error === "invalid_target");
	const wrongClient = await form("/api/oauth/token", { ...tokenBody, client_id: "orbc_doesnotexist" });
	check("token: unknown client → invalid_client 401", wrongClient.status === 401 && wrongClient.json?.error === "invalid_client");
	const tok = await form("/api/oauth/token", tokenBody);
	check(
		"token: code + PKCE → access + refresh",
		tok.status === 200 && tok.json?.token_type === "Bearer" && tok.json?.expires_in === 3600 && tok.json?.access_token?.startsWith("orb_at_") && !!tok.json?.refresh_token && tok.json?.scope === "read write",
		tok.text.slice(0, 120)
	);
	check("token response is no-store", (tok.headers.get("cache-control") || "").includes("no-store"));
	const access: string = tok.json?.access_token || "";
	const refresh: string = tok.json?.refresh_token || "";

	// stored hashed
	const { data: stored } = await db.from("oauth_tokens").select("token_hash").eq("token_hash", sha256hex(access)).maybeSingle();
	check("access token stored only as SHA-256 hash", !!stored);

	// 5. MCP with the access token ------------------------------------------
	const client = await mcpClient(access);
	const tools = await client.listTools();
	check("MCP tools/list with OAuth token", tools.tools.some((t) => t.name === "search_jobs"), `${tools.tools.length} tools`);
	const search = await client.callTool({ name: "search_jobs", arguments: { limit: 3 } });
	check("MCP search_jobs with OAuth token", !search.isError, JSON.stringify(search.content).slice(0, 100));
	await client.close();
	const { data: grantRow } = await db
		.from("oauth_grants")
		.select("id, last_used_at, last_client, scopes")
		.eq("client_id", clientId)
		.is("revoked_at", null)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();
	check("grant tracks last_used_at + MCP client name", !!grantRow?.last_used_at && grantRow?.last_client === "claude-ai", grantRow?.last_client || "");

	// 6. Code reuse -----------------------------------------------------------
	const reuse = await form("/api/oauth/token", tokenBody);
	check("token: reused code → invalid_grant", reuse.json?.error === "invalid_grant");
	check("reused code revoked the tokens issued with it", (await mcpStatus(access)).status === 401);

	// 7. Refresh rotation (fresh authorization, since the replay revoked the first)
	const second = await authorizeAndExchange(cookie, clientId, CHATGPT_CALLBACK);
	check("second authorization (ChatGPT redirect) issues tokens", second.tok.status === 200, second.tok.text.slice(0, 80));
	const r1 = await form("/api/oauth/token", { grant_type: "refresh_token", refresh_token: second.tok.json.refresh_token, client_id: clientId, resource: MCP_URL });
	check("refresh → new access + rotated refresh", r1.status === 200 && r1.json.refresh_token !== second.tok.json.refresh_token && r1.json.access_token !== second.tok.json.access_token);
	check("refreshed access token works on MCP", (await mcpStatus(r1.json.access_token)).status === 200);
	const rOld = await form("/api/oauth/token", { grant_type: "refresh_token", refresh_token: second.tok.json.refresh_token, client_id: clientId });
	check("old refresh token rejected after rotation", rOld.json?.error === "invalid_grant");
	const rScope = await form("/api/oauth/token", { grant_type: "refresh_token", refresh_token: r1.json.refresh_token, client_id: clientId, scope: "read write admin" });
	check("refresh ignores unknown scopes, keeps granted ones", rScope.status === 200 && rScope.json.scope === "read write", rScope.text.slice(0, 80));
	const r2 = rScope;

	// 8. Expired + wrong-audience tokens --------------------------------------
	await db.from("oauth_tokens").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token_hash", sha256hex(r1.json.access_token));
	const expired = await mcpStatus(r1.json.access_token);
	check("expired access token → 401 invalid_token", expired.status === 401 && /invalid_token/.test(expired.www) && /expired/.test(expired.www), expired.www.slice(0, 160));
	await db.from("oauth_tokens").update({ resource: "https://other.example/api/mcp" }).eq("token_hash", sha256hex(r2.json.access_token));
	const wrongAud = await mcpStatus(r2.json.access_token);
	check("token for another resource → 401", wrongAud.status === 401 && /different resource/.test(wrongAud.www));
	check("PAT-style malformed token still → 401", (await mcpStatus("orb_at_garbage")).status === 401);

	// 9. Revocation ----------------------------------------------------------
	const r3 = await form("/api/oauth/token", { grant_type: "refresh_token", refresh_token: r2.json.refresh_token, client_id: clientId });
	check("refresh again", r3.status === 200);
	check("access token works before revoke", (await mcpStatus(r3.json.access_token)).status === 200);
	const rev = await form("/api/oauth/revoke", { token: r3.json.access_token, token_type_hint: "access_token", client_id: clientId });
	check("revoke access token → 200", rev.status === 200);
	check("revoked access token → 401", (await mcpStatus(r3.json.access_token)).status === 401);
	const revR = await form("/api/oauth/revoke", { token: r3.json.refresh_token, client_id: clientId });
	const afterRevR = await form("/api/oauth/token", { grant_type: "refresh_token", refresh_token: r3.json.refresh_token, client_id: clientId });
	check("revoke refresh token → grant ended", revR.status === 200 && afterRevR.json?.error === "invalid_grant");
	const revUnknown = await form("/api/oauth/revoke", { token: "nope", client_id: clientId });
	check("revoke unknown token → 200 (RFC 7009)", revUnknown.status === 200);

	// 10. Read-only consent + Settings API -----------------------------------
	const ro = await authorizeAndExchange(cookie, clientId, CLAUDE_CALLBACK, { write: false });
	check("unticking write → read-only token", ro.tok.json?.scope === "read", ro.tok.json?.scope);
	const roClient = await mcpClient(ro.tok.json.access_token);
	const roWrite = await roClient.callTool({ name: "update_application_status", arguments: { application_id: "00000000-0000-0000-0000-000000000000", status: "applied" } });
	check("read-only OAuth token cannot write", !!roWrite.isError && /read-only/.test(JSON.stringify(roWrite.content)));
	await roClient.close();
	const grantsRes = await fetch(`${BASE}/api/oauth/grants`, { headers: { Cookie: cookie } });
	const grantsPayload = (await grantsRes.json()) as { grants: { id: string; client_id: string; scopes: string[] }[] };
	const grants = grantsPayload.grants;
	const roGrant = grants.find((g) => g.client_id === clientId && g.scopes.join() === "read");
	check("Settings API lists the connected app", grantsRes.status === 200 && !!roGrant, `${grants.length} active grants`);
	const del = await fetch(`${BASE}/api/oauth/grants/${roGrant?.id}`, { method: "DELETE", headers: { Cookie: cookie, Origin: BASE } });
	check("Settings revoke → 200", del.status === 200);
	check("token of a revoked connection → 401", (await mcpStatus(ro.tok.json.access_token)).status === 401);
	const anonGrants = await fetch(`${BASE}/api/oauth/grants`);
	check("Settings API needs login", anonGrants.status === 401);

	// 11. Confidential DCR client --------------------------------------------
	const conf = await register({ client_name: "OAuth smoke (confidential)", redirect_uris: [CHATGPT_CALLBACK] });
	check("DCR default auth method issues a client_secret", conf.status === 201 && !!conf.json.client_secret && conf.json.token_endpoint_auth_method === "client_secret_basic");
	{
		const { verifier: v, challenge: ch } = pkce();
		const cc = await consent(
			authorizeUrl({ response_type: "code", client_id: conf.json.client_id, redirect_uri: CHATGPT_CALLBACK, code_challenge: ch, code_challenge_method: "S256", state: "c1", resource: MCP_URL }),
			cookie
		);
		const ccode = cc.redirect?.searchParams.get("code") || "";
		const body = { grant_type: "authorization_code", code: ccode, code_verifier: v, redirect_uri: CHATGPT_CALLBACK };
		const noSecret = await form("/api/oauth/token", { ...body, client_id: conf.json.client_id });
		check("confidential client without secret → invalid_client", noSecret.status === 401);
		const basic = Buffer.from(`${encodeURIComponent(conf.json.client_id)}:${encodeURIComponent(conf.json.client_secret)}`).toString("base64");
		const withSecret = await form("/api/oauth/token", body, { Authorization: `Basic ${basic}` });
		check("confidential client with Basic auth → tokens", withSecret.status === 200 && !!withSecret.json.access_token, withSecret.text.slice(0, 80));
	}

	// 12. Official SDK OAuth flow (DCR, then claude.ai's metadata document) ---
	await sdkFlow(cookie, "SDK+DCR", "http://localhost:6274/oauth/callback");
	if (RUN_CIMD) {
		const p = await sdkFlow(cookie, "SDK+CIMD (claude.ai)", CLAUDE_CALLBACK, CLAUDE_CIMD);
		createdClients.add(CLAUDE_CIMD);
		const { data: cimd } = await db.from("oauth_clients").select("client_name, registration_type").eq("client_id", CLAUDE_CIMD).maybeSingle();
		check("CIMD client cached with its published name", cimd?.client_name === "Claude" && cimd?.registration_type === "metadata_document", cimd?.client_name);
		void p;
		const badCimd = await fetch(
			authorizeUrl({ ...authParams, client_id: CLAUDE_CIMD, redirect_uri: "https://evil.example/cb" }),
			{ headers: { Cookie: cookie }, redirect: "manual" }
		);
		check("CIMD: redirect not in the document → error page", badCimd.status === 200 && /Invalid redirect/.test(await badCimd.text()));
		const ssrf = await fetch(authorizeUrl({ ...authParams, client_id: "https://127.0.0.1/client.json" }), { headers: { Cookie: cookie }, redirect: "manual" });
		check("CIMD: private-address client_id refused", ssrf.status === 200 && /not public|Unknown application/.test(await ssrf.text()));
	}
}

async function cleanup() {
	for (const id of Array.from(createdClients)) {
		const { error } = await db.from("oauth_clients").delete().eq("client_id", id);
		if (error) console.error(`cleanup ${id}: ${error.message}`);
	}
	console.log(`cleanup: removed ${createdClients.size} client(s) with their grants, codes and tokens`);
}

main()
	.catch((err) => {
		failures++;
		console.error("FATAL", err);
	})
	.finally(async () => {
		await cleanup();
		console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll OAuth checks passed");
		process.exit(failures ? 1 : 0);
	});
