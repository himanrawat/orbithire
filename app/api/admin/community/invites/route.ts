import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { logAdminActivity, requireAdmin } from "@/lib/adminAuth";
import { createInvite, revokeInvite } from "@/lib/community/moderationServer";
import { createInviteSchema, idSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** POST /api/admin/community/invites { maxUses, expiresInDays?, field? } – admins and up. */
export async function POST(req: NextRequest) {
	const admin = await requireAdmin({ minRole: "admin" });
	if (!admin) return unauthorized();
	const parsed = await parseJson(req, createInviteSchema);
	if (!parsed.success) return parsed.response;

	try {
		const invite = await createInvite(admin.id, parsed.data);
		await logAdminActivity(admin.id, "community_invite_create", {
			targetType: "community_invite",
			targetId: invite.id,
			details: { max_uses: invite.max_uses, field: invite.field, expires_at: invite.expires_at },
		});
		return NextResponse.json({ invite }, { status: 201 });
	} catch (error) {
		console.error("[admin/community] create invite failed:", error);
		return NextResponse.json({ error: "Could not create the invite" }, { status: 500 });
	}
}

/** DELETE /api/admin/community/invites?id=… – revoke an invite (kept for the record). */
export async function DELETE(req: NextRequest) {
	const admin = await requireAdmin({ minRole: "admin" });
	if (!admin) return unauthorized();
	const id = req.nextUrl.searchParams.get("id");
	if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid invite id" }, { status: 400 });

	try {
		const revoked = await revokeInvite(id as string);
		if (!revoked) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
		await logAdminActivity(admin.id, "community_invite_revoke", { targetType: "community_invite", targetId: id });
		return NextResponse.json({ revoked: true });
	} catch (error) {
		console.error("[admin/community] revoke invite failed:", error);
		return NextResponse.json({ error: "Could not revoke the invite" }, { status: 500 });
	}
}
