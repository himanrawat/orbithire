import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { revokeGrant } from "@/lib/oauth/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/oauth/grants/:id – disconnect an app: revokes the grant and all its tokens.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
	const service = createServiceSupabase();
	const { data, error } = await service
		.from("oauth_grants")
		.select("id")
		.eq("id", params.id)
		.eq("user_id", auth.user.id)
		.maybeSingle();
	if (error) return NextResponse.json({ error: "Failed to revoke" }, { status: 500 });
	if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
	await revokeGrant(service, data.id);
	return NextResponse.json({ ok: true });
}
