/** Server-only helpers shared by the /api/import/* routes. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabaseServer";
import type { ExistingCompany } from "./tracker";

export async function getImportUser(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user ? { supabase, userId: user.id } : null;
}

/** All of the user's applications with the fields the import planners need (RLS client). */
export async function loadUserCompanies(supabase: SupabaseClient, userId: string): Promise<ExistingCompany[]> {
	const { data, error } = await supabase
		.from("companies")
		.select("id, name, job_title, status, notes, job_url, industry, recruiter_name, applied_at")
		.eq("user_id", userId)
		.order("created_at", { ascending: true })
		.limit(5000);
	if (error) throw new Error(`Could not load applications: ${error.message}`);
	return (data || []) as ExistingCompany[];
}
