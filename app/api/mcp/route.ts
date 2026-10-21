/**
 * /api/mcp – OrbitHire MCP server (Model Context Protocol), Phase 4.
 *
 * Transport: Streamable HTTP in STATELESS mode via the SDK's web-standard
 * transport (no session ids; every POST builds a fresh server + transport and
 * returns a plain JSON response). GET (standalone SSE stream) and DELETE
 * (session end) are not used in stateless mode → 405.
 *
 * Auth: `Authorization: Bearer …` with either a personal access token
 * (`orb_…`, Settings → AI connections; Claude Desktop / Claude Code) or an
 * OAuth 2.1 access token (`orb_at_…`, claude.ai / ChatGPT connectors, see
 * lib/oauth). Missing/invalid/revoked/expired tokens get a 401 with an RFC 6750
 * challenge carrying `resource_metadata` (RFC 9728) so MCP clients can
 * discover the authorization server: `/.well-known/oauth-protected-resource/api/mcp`.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { serverEnv } from "@/lib/config";
import { sourceClientFrom, touchToken, verifyBearer } from "@/lib/mcp/tokens";
import { checkRequestRate } from "@/lib/mcp/rateLimit";
import { buildMcpServer } from "@/lib/mcp/server";
import { acceptedResources, mcpResourceFor, resourceMetadataUrlFor, SUPPORTED_SCOPES } from "@/lib/oauth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_BYTES = 1_000_000;

function jsonRpcError(status: number, code: number, message: string, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
	});
}

function unauthorized(req: Request, error: "missing_token" | "invalid_token", description: string) {
	// RFC 6750 §3: no error code when the request simply lacked credentials.
	// RFC 9728 §5.1: resource_metadata points MCP clients at OAuth discovery.
	const parts = [
		`realm="OrbitHire MCP"`,
		`resource_metadata="${resourceMetadataUrlFor(req)}"`,
		`scope="${SUPPORTED_SCOPES.join(" ")}"`,
	];
	if (error === "invalid_token") {
		parts.push(`error="invalid_token"`, `error_description="${description.replace(/["\\]/g, "'")}"`);
	}
	return jsonRpcError(401, -32001, `Unauthorized: ${description}`, { "WWW-Authenticate": `Bearer ${parts.join(", ")}` });
}

function siteUrl(req: Request): string {
	try {
		const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
		if (configured) return configured.replace(/\/+$/, "");
		return serverEnv.siteUrl.replace(/\/+$/, "");
	} catch {
		return new URL(req.url).origin;
	}
}

/** clientInfo.name from an `initialize` request (single or batched). */
function initializeClientName(body: unknown): string | null {
	const msgs = Array.isArray(body) ? body : [body];
	for (const m of msgs) {
		if (m && typeof m === "object" && (m as { method?: string }).method === "initialize") {
			const name = (m as { params?: { clientInfo?: { name?: unknown } } }).params?.clientInfo?.name;
			if (typeof name === "string" && name.trim()) return name.trim().slice(0, 100);
		}
	}
	return null;
}

export async function POST(req: Request) {
	const service = createServiceSupabase();

	let verified;
	try {
		verified = await verifyBearer(service, req.headers.get("authorization"), {
			audiences: acceptedResources(req),
		});
	} catch {
		return jsonRpcError(503, -32603, "Authentication service unavailable");
	}
	if (!verified.ok) return unauthorized(req, verified.error, verified.description);
	const auth = verified.auth;

	const rate = checkRequestRate(auth.tokenId);
	if (!rate.ok) {
		return jsonRpcError(429, -32029, `Rate limit exceeded; retry in ${rate.retryAfter}s`, {
			"Retry-After": String(rate.retryAfter),
		});
	}

	const raw = await req.text();
	if (raw.length > MAX_BODY_BYTES) return jsonRpcError(413, -32600, "Request body too large");
	let body: unknown;
	try {
		body = JSON.parse(raw);
	} catch {
		return jsonRpcError(400, -32700, "Parse error: invalid JSON");
	}

	const initClient = initializeClientName(body);
	await touchToken(service, auth, initClient);
	const clientName = initClient || auth.lastClient || auth.clientName || req.headers.get("user-agent");

	const server = buildMcpServer({
		service,
		auth,
		sourceClient: sourceClientFrom(clientName),
		siteUrl: siteUrl(req),
	});
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined, // stateless
		enableJsonResponse: true,
	});
	try {
		await server.connect(transport);
		const response = await transport.handleRequest(req, {
			parsedBody: body,
			authInfo: {
				token: auth.kind === "oauth" ? "orb_at_…" : "orb_…", // never pass the secret on
				clientId: auth.tokenId,
				scopes: auth.scopes,
				resource: new URL(mcpResourceFor(req)),
				extra: { userId: auth.userId, kind: auth.kind },
			},
		});
		return response;
	} catch (err) {
		console.error("[mcp] request failed:", err);
		return jsonRpcError(500, -32603, "Internal server error");
	} finally {
		// JSON response mode: the Response is fully built at this point.
		void transport.close().catch(() => {});
		void server.close().catch(() => {});
	}
}

function methodNotAllowed() {
	return jsonRpcError(405, -32000, "Method not allowed: this MCP server is stateless, use POST", { Allow: "POST" });
}

export async function GET() {
	return methodNotAllowed();
}

export async function DELETE() {
	return methodNotAllowed();
}
