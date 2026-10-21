/**
 * RFC 7009 token revocation. Revoking a refresh token ends the whole
 * connection (grant); revoking an access token ends just that token.
 * Responds 200 for unknown tokens, as the RFC requires.
 */
import { createServiceSupabase } from "@/lib/supabaseServer";
import { authenticateClient, getClient } from "@/lib/oauth/clients";
import { revokeToken } from "@/lib/oauth/grants";
import { clientCredentials, json, oauthError, preflight, readParams } from "@/lib/oauth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const params = await readParams(req);
	const token = params.get("token");
	if (!token) return oauthError("invalid_request", "token is required");
	const creds = clientCredentials(req, params);
	if (!creds.clientId) return oauthError("invalid_client", "client_id is required", 401);
	const service = createServiceSupabase();
	try {
		const client = await getClient(service, creds.clientId);
		if (!client || !authenticateClient(client, creds.clientSecret)) {
			return oauthError("invalid_client", "Client authentication failed", 401);
		}
		await revokeToken(service, client, token);
		return json({});
	} catch (err) {
		console.error("[oauth] revocation failed:", err);
		return oauthError("server_error", "Revocation failed", 500);
	}
}

export function OPTIONS() {
	return preflight();
}
