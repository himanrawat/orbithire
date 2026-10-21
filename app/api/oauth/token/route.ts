/**
 * OAuth 2.1 token endpoint: authorization_code (PKCE S256 required) and
 * refresh_token (rotating). Access tokens live 1 h and are bound to the
 * resource (RFC 8707) chosen at authorization time.
 */
import { createServiceSupabase } from "@/lib/supabaseServer";
import { authenticateClient, ClientError, getClient } from "@/lib/oauth/clients";
import { exchangeAuthorizationCode, exchangeRefreshToken, GrantError } from "@/lib/oauth/grants";
import { callerIp, clientCredentials, json, oauthError, preflight, rateLimited, readParams } from "@/lib/oauth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	if (rateLimited(`token:${callerIp(req)}`, 120, 60_000)) {
		return oauthError("temporarily_unavailable", "Too many token requests", 429, { "Retry-After": "60" });
	}
	const params = await readParams(req);
	const grantType = params.get("grant_type");
	if (grantType !== "authorization_code" && grantType !== "refresh_token") {
		return oauthError("unsupported_grant_type", "Supported: authorization_code, refresh_token");
	}
	const creds = clientCredentials(req, params);
	if (!creds.clientId) return oauthError("invalid_client", "client_id is required", 401);

	const service = createServiceSupabase();
	try {
		const client = await getClient(service, creds.clientId);
		if (!client || !authenticateClient(client, creds.clientSecret)) {
			return oauthError("invalid_client", "Client authentication failed", 401, {
				"WWW-Authenticate": 'Basic realm="OrbitHire OAuth"',
			});
		}
		if (!client.grant_types.includes(grantType)) {
			return oauthError("unauthorized_client", `This client may not use ${grantType}`);
		}
		const tokens =
			grantType === "authorization_code"
				? await exchangeAuthorizationCode(service, client, params)
				: await exchangeRefreshToken(service, client, params);
		return json(tokens);
	} catch (err) {
		if (err instanceof GrantError) return oauthError(err.code, err.message, err.code === "invalid_client" ? 401 : 400);
		if (err instanceof ClientError) return oauthError("invalid_client", err.message, 401);
		console.error("[oauth] token endpoint failed:", err);
		return oauthError("server_error", "Token request failed", 500);
	}
}

export function OPTIONS() {
	return preflight();
}
