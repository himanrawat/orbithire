import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { parseJson } from "@/lib/api";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { accountDeleteSchema, confirmationMatches } from "@/lib/account/delete";
import { deleteUserAccount } from "@/lib/account/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

async function signOutQuietly(supabase: ReturnType<typeof createServerSupabase>) {
	try {
		await supabase.auth.signOut();
	} catch (error) {
		// The auth user is already gone; clearing the cookie is best effort.
		console.warn("[account/delete] sign-out after delete:", error);
	}
}

/**
 * POST /api/account/delete { confirmEmail } — permanently deletes the signed-in
 * user's account, data and stored files. The user must type their sign-in email.
 */
export async function POST(req: NextRequest) {
	const supabase = createServerSupabase();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	}

	const limited = await enforceRateLimit(req, {
		scope: "account.delete",
		limit: 5,
		windowSeconds: 60 * 60,
		identifier: user.id,
	});
	if (limited) return limited;

	const parsed = await parseJson(req, accountDeleteSchema);
	if (!parsed.success) return parsed.response;
	if (!confirmationMatches(parsed.data.confirmEmail, user.email)) {
		return NextResponse.json(
			{ error: "That email doesn't match the one on your account." },
			{ status: 400 }
		);
	}

	const result = await deleteUserAccount(user.id);
	if (!result.ok) {
		return NextResponse.json(
			{ error: `${result.message} Please try again, or email info@himanshurawat.in and we will finish it for you.` },
			{ status: 500 }
		);
	}

	await signOutQuietly(supabase);
	return NextResponse.json({ success: true, filesDeleted: result.filesDeleted });
}
