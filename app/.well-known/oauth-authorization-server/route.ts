/** RFC 8414 Authorization Server Metadata (issuer = this app's origin). */
import { metadata, preflight } from "@/lib/oauth/http";
import { authorizationServerMetadata } from "@/lib/oauth/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	return metadata(authorizationServerMetadata(req));
}

export function OPTIONS() {
	return preflight();
}
