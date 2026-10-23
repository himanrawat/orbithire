import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { pushEventSchema } from "@/lib/pwa/schemas";
import { recordPushEvent } from "@/lib/pwa/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/push/events { platform, event: "denied" } – the browser's permission prompt
 * was declined. Subscribe/unsubscribe are recorded by /api/push/subscription.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	// Each row feeds the admin opt-out metric, so one account can't flood it.
	const limited = await enforceRateLimit(req, {
		scope: "push.events",
		limit: 20,
		windowSeconds: 3600,
		identifier: auth.user.id,
	});
	if (limited) return limited;
	const parsed = await parseJson(req, pushEventSchema);
	if (!parsed.success) return parsed.response;
	await recordPushEvent(auth.supabase, auth.user.id, parsed.data.platform, parsed.data.event);
	return NextResponse.json({ ok: true });
}
