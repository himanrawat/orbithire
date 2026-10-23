import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { logAdminActivity, requireAdmin } from "@/lib/adminAuth";
import { updateLaunchField } from "@/lib/community/moderationServer";
import { communitySettingsSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/admin/community/settings { launchField } – admins and up. New invites default to it. */
export async function PATCH(req: NextRequest) {
	const admin = await requireAdmin({ minRole: "admin" });
	if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const parsed = await parseJson(req, communitySettingsSchema);
	if (!parsed.success) return parsed.response;

	try {
		await updateLaunchField(parsed.data.launchField);
		await logAdminActivity(admin.id, "community_settings_update", {
			targetType: "settings",
			targetId: null,
			details: { launch_field: parsed.data.launchField },
		});
		return NextResponse.json({ launchField: parsed.data.launchField });
	} catch (error) {
		console.error("[admin/community] settings failed:", error);
		return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
	}
}
