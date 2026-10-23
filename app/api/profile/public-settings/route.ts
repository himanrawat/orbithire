import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { publicSettingsSchema } from "@/lib/milestones/schema";
import { jsonError, loadPublicSettings, savePublicSettings } from "@/lib/milestones/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profile/public-settings → { settings } (owner only). Includes open_to_roles,
 * which is only ever returned to its owner.
 */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		return NextResponse.json({ settings: await loadPublicSettings(auth.supabase, auth.user.id) });
	} catch (error) {
		console.error("[profile] public settings load failed:", error);
		return jsonError("Could not load your profile settings", 500);
	}
}

/** PATCH /api/profile/public-settings { public_handle?, public_profile_enabled?, search_indexing?, open_to_roles? } */
export async function PATCH(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await parseJson(req, publicSettingsSchema);
	if (!body.success) return body.response;
	try {
		const result = await savePublicSettings(auth.supabase, auth.user.id, body.data);
		if ("error" in result) return jsonError(result.error, result.status);
		return NextResponse.json({ settings: result.settings });
	} catch (error) {
		console.error("[profile] public settings save failed:", error);
		return jsonError("Could not save your profile settings", 500);
	}
}
