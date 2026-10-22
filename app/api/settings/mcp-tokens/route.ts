import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { generateToken, normalizeScopes } from "@/lib/mcp/tokens";
import { parseJson } from "@/lib/api";
import { mcpTokenCreateSchema } from "@/lib/schemas/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ACTIVE_TOKENS = 20;
const COLUMNS = "id, name, token_prefix, scopes, last_used_at, last_client, revoked_at, created_at";

// GET /api/settings/mcp-tokens – the user's MCP access tokens (never the secret)
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { data, error } = await auth.supabase
		.from("mcp_tokens")
		.select(COLUMNS)
		.eq("user_id", auth.user.id)
		.order("created_at", { ascending: false });
	if (error) {
		console.error("[mcp-tokens] list failed:", error);
		return NextResponse.json({ error: "Failed to load tokens" }, { status: 500 });
	}
	return NextResponse.json({ tokens: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/settings/mcp-tokens  { name, scopes: ["read"] | ["read","write"] }
 * Returns the full token ONCE; only its SHA-256 hash is stored.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, mcpTokenCreateSchema);
	if (!parsed.success) return parsed.response;
	const name = parsed.data.name;
	const scopes = normalizeScopes(parsed.data.scopes);
	if (!scopes.length) return NextResponse.json({ error: "Pick at least one scope" }, { status: 400 });

	const { count } = await auth.supabase
		.from("mcp_tokens")
		.select("id", { count: "exact", head: true })
		.eq("user_id", auth.user.id)
		.is("revoked_at", null);
	if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
		return NextResponse.json({ error: `At most ${MAX_ACTIVE_TOKENS} active tokens – revoke one first` }, { status: 400 });
	}

	const { token, hash, prefix } = generateToken();
	const { data, error } = await auth.supabase
		.from("mcp_tokens")
		.insert({ user_id: auth.user.id, name, token_hash: hash, token_prefix: prefix, scopes })
		.select(COLUMNS)
		.single();
	if (error || !data) {
		console.error("[mcp-tokens] create failed:", error);
		return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
	}
	return NextResponse.json({ token: data, secret: token }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
