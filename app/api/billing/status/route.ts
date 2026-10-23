import { NextResponse } from "next/server";
import { getPlan } from "@/lib/billing/plan";
import { requireBillingUser } from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/billing/status — the signed-in user's plan for Settings → Billing. */
export async function GET() {
	const auth = await requireBillingUser();
	if (auth instanceof NextResponse) return auth;
	const plan = await getPlan(auth.user.id, auth.supabase);
	return NextResponse.json({ plan });
}
