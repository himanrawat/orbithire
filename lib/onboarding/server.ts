import "server-only";

import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabaseServer";
import { COMPLETION_COOKIE, needsOnboarding } from "./stages";

/**
 * True when the signed-in person should be sent to /onboarding: they never finished or
 * skipped setup and haven't been shown it in this browser. Fails open (no redirect) on
 * any error, e.g. before the migration has run.
 */
export async function shouldRedirectToOnboarding(): Promise<boolean> {
	if (cookies().has(COMPLETION_COOKIE)) return false;
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return false;
		const { data, error } = await supabase.from("profiles").select("onboarded_at").eq("id", user.id).maybeSingle();
		if (error || !data) return false;
		return needsOnboarding(data.onboarded_at as string | null, false);
	} catch {
		return false;
	}
}
