import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Timer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MockInterview } from "@/components/prep/MockInterview";
import { canUse, getPlan } from "@/lib/billing/plan";
import { createServerSupabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mock interview" };

async function mockAllowed(): Promise<boolean> {
	const supabase = createServerSupabase() as unknown as SupabaseClient;
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin?redirect=/prep/mock");
	return canUse(await getPlan(user.id, supabase), "mock_interviews");
}

export default async function MockPage() {
	const allowed = await mockAllowed();
	return (
		<div className="relative mx-auto max-w-3xl px-4 py-8 md:px-8">
			<PageHeader
				back={{ href: "/prep", label: "Interview prep" }}
				icon={<Timer />}
				title="30-minute mock interview"
				description="Practice under time, the way a real round feels. This is practice only, never help during a live interview."
			/>
			<MockInterview allowed={allowed} />
		</div>
	);
}
