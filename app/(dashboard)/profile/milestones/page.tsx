import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MilestonesPageClient } from "@/components/milestones/MilestonesPageClient";
import { loadOwnerSummary } from "@/lib/milestones/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export const metadata: Metadata = { title: "Milestones" };
export const dynamic = "force-dynamic";

export default async function MilestonesPage() {
	const supabase = createServerSupabase() as unknown as SupabaseClient;
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin?redirect=/profile/milestones");
	const owner = await loadOwnerSummary(supabase, user.id);
	return <MilestonesPageClient owner={owner} />;
}
