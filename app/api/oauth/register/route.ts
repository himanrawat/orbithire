/**
 * RFC 7591 Dynamic Client Registration (open registration; the user still has
 * to log in and approve every client on the consent screen). Redirect URIs:
 * https, or http on localhost / 127.0.0.1. Kept for clients that don't use
 * Client ID Metadata Documents (e.g. ChatGPT, MCP Inspector, Claude Code).
 */
import { createServiceSupabase } from "@/lib/supabaseServer";
import { ClientError, registerClient } from "@/lib/oauth/clients";
import { callerIp, json, oauthError, preflight, rateLimited } from "@/lib/oauth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	if (rateLimited(`register:${callerIp(req)}`, 30, 3600_000)) {
		return oauthError("temporarily_unavailable", "Too many registrations, try again later", 429, { "Retry-After": "3600" });
	}
	const raw = await req.text();
	if (raw.length > 20_000) return oauthError("invalid_client_metadata", "Registration request too large");
	let body: unknown;
	try {
		body = JSON.parse(raw);
	} catch {
		return oauthError("invalid_client_metadata", "Body must be JSON");
	}
	try {
		const { response } = await registerClient(createServiceSupabase(), body);
		return json(response, 201);
	} catch (err) {
		if (err instanceof ClientError) {
			const code = err.code === "invalid_redirect_uri" ? "invalid_redirect_uri" : "invalid_client_metadata";
			return oauthError(code, err.message);
		}
		console.error("[oauth] registration failed:", err);
		return oauthError("server_error", "Registration failed", 500);
	}
}

export function OPTIONS() {
	return preflight();
}
