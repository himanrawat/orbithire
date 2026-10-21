import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/oauth/grants – apps connected via OAuth (claude.ai, ChatGPT, …), newest first.
// RLS (oauth_grants_select_own) limits rows to the caller; the filter is explicit too.
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { data, error } = await auth.supabase
		.from("oauth_grants")
		.select("id, client_id, client_name, redirect_host, scopes, last_used_at, last_client, created_at")
		.eq("user_id", auth.user.id)
		.is("revoked_at", null)
		.order("created_at", { ascending: false })
		.limit(100);
	if (error) {
		console.error("[oauth-grants] list failed:", error);
		return NextResponse.json({ error: "Failed to load connected apps" }, { status: 500 });
	}
	return NextResponse.json({ grants: data || [] }, { headers: { "Cache-Control": "no-store" } });
}
