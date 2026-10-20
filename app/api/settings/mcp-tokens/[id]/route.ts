import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

// DELETE /api/settings/mcp-tokens/:id – revoke (kept for the audit trail, unusable from now on)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Token not found" }, { status: 404 });
	const { data, error } = await auth.supabase
		.from("mcp_tokens")
		.update({ revoked_at: new Date().toISOString() })
		.eq("id", params.id)
		.eq("user_id", auth.user.id)
		.is("revoked_at", null)
		.select("id, revoked_at")
		.maybeSingle();
	if (error) {
		console.error("[mcp-tokens] revoke failed:", error);
		return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 });
	}
	if (!data) return NextResponse.json({ error: "Token not found or already revoked" }, { status: 404 });
	return NextResponse.json({ token: data });
}
