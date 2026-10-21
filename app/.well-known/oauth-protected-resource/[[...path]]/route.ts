/**
 * RFC 9728 Protected Resource Metadata for the MCP server.
 *   /.well-known/oauth-protected-resource          (root fallback)
 *   /.well-known/oauth-protected-resource/api/mcp  (path-suffixed, advertised in the 401)
 */
import { metadata, preflight } from "@/lib/oauth/http";
import { MCP_PATH } from "@/lib/oauth/config";
import { protectedResourceMetadata } from "@/lib/oauth/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { path?: string[] } }) {
	const suffix = params.path?.length ? "/" + params.path.join("/") : "";
	if (suffix && suffix.replace(/\/+$/, "") !== MCP_PATH) {
		return new Response(JSON.stringify({ error: "not_found" }), {
			status: 404,
			headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
		});
	}
	return metadata(protectedResourceMetadata(req));
}

export function OPTIONS() {
	return preflight();
}
