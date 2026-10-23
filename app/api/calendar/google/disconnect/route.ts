import { NextResponse } from "next/server";
import { disconnectGoogle } from "@/lib/calendar/google/connection";
import { requireUser } from "@/lib/focus/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/google/disconnect – revokes the Google grant and deletes the tokens.
 * The auth cookie is SameSite=Lax, so a cross-site form can't send this POST signed in.
 */
export async function POST() {
	const auth = await requireUser();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		await disconnectGoogle(auth.userId);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Could not disconnect Google Calendar" }, { status: 500 });
	}
}
