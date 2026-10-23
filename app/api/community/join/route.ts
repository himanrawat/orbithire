import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser, serverError } from "@/lib/jobs/server";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { joinSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR_COPY: Readonly<Record<string, string>> = {
	invalid: "That invite code doesn't match an active invite.",
	expired: "That invite has expired. Ask for a new one.",
	used_up: "That invite has been used up. Ask for a new one.",
	suspended: "Your community access is paused.",
};

type RedeemResult = { ok?: boolean; field?: string; error?: string } | null;

/** POST /api/community/join { code } – redeem an invite code (atomic, in the database). */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const limited = await enforceRateLimit(req, {
		scope: "community.join",
		limit: 10,
		windowSeconds: 3600,
		identifier: auth.user.id,
	});
	if (limited) return limited;
	const parsed = await parseJson(req, joinSchema);
	if (!parsed.success) return parsed.response;

	const { data, error } = await auth.supabase.rpc("redeem_community_invite", { p_code: parsed.data.code });
	if (error) return serverError("Could not redeem this invite", error);
	const result = data as RedeemResult;
	if (!result?.ok) {
		return NextResponse.json({ error: ERROR_COPY[result?.error ?? "invalid"] ?? ERROR_COPY.invalid }, { status: 400 });
	}
	return NextResponse.json({ field: result.field ?? null });
}
