import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser, serverError } from "@/lib/jobs/server";
import { notificationPreferencesSchema, withPreferenceDefaults } from "@/lib/pwa/schemas";
import { vapidPublicKey } from "@/lib/pwa/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = "morning_plan, follow_ups, interviews, email_fallback";

/**
 * GET /api/push/preferences → { preferences, vapidPublicKey, devices }. `vapidPublicKey`
 * is null when push is not configured on this server (the UI then hides push controls).
 */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const [prefs, devices] = await Promise.all([
		auth.supabase.from("notification_preferences").select(COLUMNS).eq("user_id", auth.user.id).maybeSingle(),
		auth.supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id),
	]);
	if (prefs.error) return serverError("Could not load notification settings", prefs.error);
	return NextResponse.json({
		preferences: withPreferenceDefaults(prefs.data),
		vapidPublicKey: vapidPublicKey(),
		devices: devices.count ?? 0,
	});
}

/** PATCH /api/push/preferences { morning_plan?, follow_ups?, interviews?, email_fallback? } */
export async function PATCH(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, notificationPreferencesSchema);
	if (!parsed.success) return parsed.response;
	const { data, error } = await auth.supabase
		.from("notification_preferences")
		.upsert({ user_id: auth.user.id, ...parsed.data }, { onConflict: "user_id" })
		.select(COLUMNS)
		.single();
	if (error) return serverError("Could not save notification settings", error);
	return NextResponse.json({ preferences: withPreferenceDefaults(data) });
}
