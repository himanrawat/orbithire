import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser, serverError } from "@/lib/jobs/server";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/pwa/schemas";
import { recordPushEvent, vapidPublicKey } from "@/lib/pwa/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pushOff() {
	return NextResponse.json({ error: "Push notifications are not available" }, { status: 404 });
}

/** POST /api/push/subscription – save this device's push subscription (after a tap). */
export async function POST(req: NextRequest) {
	if (!vapidPublicKey()) return pushOff();
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const limited = await enforceRateLimit(req, {
		scope: "push.subscribe",
		limit: 30,
		windowSeconds: 3600,
		identifier: auth.user.id,
	});
	if (limited) return limited;
	const parsed = await parseJson(req, pushSubscriptionSchema);
	if (!parsed.success) return parsed.response;

	const { endpoint, keys, platform } = parsed.data;
	const { error } = await auth.supabase.rpc("upsert_push_subscription", {
		p_endpoint: endpoint,
		p_p256dh: keys.p256dh,
		p_auth: keys.auth,
		p_platform: platform,
		p_user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
	});
	if (error) return serverError("Could not turn on notifications", error);
	await recordPushEvent(auth.supabase, auth.user.id, platform, "subscribed");
	return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/push/subscription { endpoint, platform } – turn push off on this device. */
export async function DELETE(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, pushUnsubscribeSchema);
	if (!parsed.success) return parsed.response;

	const { error } = await auth.supabase
		.from("push_subscriptions")
		.delete()
		.eq("user_id", auth.user.id)
		.eq("endpoint", parsed.data.endpoint);
	if (error) return serverError("Could not turn off notifications", error);
	await recordPushEvent(auth.supabase, auth.user.id, parsed.data.platform, "unsubscribed");
	return NextResponse.json({ ok: true });
}
