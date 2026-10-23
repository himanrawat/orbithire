import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { logAdminActivity, requireAdmin } from "@/lib/adminAuth";
import { applyModeration } from "@/lib/community/moderationServer";
import { idSchema, moderationActionSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

/** POST /api/admin/moderation/:reportId { action: hide | dismiss | suspend, note? } – moderators and up. */
export async function POST(req: NextRequest, { params }: RouteContext) {
	const admin = await requireAdmin({ minRole: "moderator" });
	if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
	const parsed = await parseJson(req, moderationActionSchema);
	if (!parsed.success) return parsed.response;

	try {
		const outcome = await applyModeration(params.id, parsed.data.action, admin.id, parsed.data.note);
		if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
		await logAdminActivity(admin.id, `moderation_${parsed.data.action}`, {
			targetType: outcome.report.target_type,
			targetId: outcome.report.target_id,
			details: {
				report_id: outcome.report.id,
				reason: outcome.report.reason,
				resolution: outcome.resolution,
				suspended_user_id: outcome.suspendedUserId,
				note: parsed.data.note ?? null,
			},
		});
		return NextResponse.json({ ok: true, resolution: outcome.resolution });
	} catch (error) {
		console.error("[admin/moderation] action failed:", error);
		return NextResponse.json({ error: "Could not apply this action" }, { status: 500 });
	}
}
