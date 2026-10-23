import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MarketingShell, getRedirectQuery, type SearchParams } from "@/components/marketing/marketing-shell";
import { PublicProfileView } from "@/components/milestones/PublicProfileView";
import {
	displayName,
	isValidHandle,
	normalizeHandle,
	publicProfilePath,
	publicProfileRobots,
} from "@/lib/milestones/model";
import { loadPublicProfile } from "@/lib/milestones/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Public profile (PRD area 7). Read only through get_public_profile(), which returns public
// fields for enabled profiles. Search engines are told not to index it unless the owner
// opted in. /u/* is left out of the sitemap on purpose.

export const dynamic = "force-dynamic";

type Props = Readonly<{ params: { handle: string }; searchParams?: SearchParams }>;

const getProfile = cache(async (raw: string) => {
	const handle = normalizeHandle(decodeURIComponent(raw));
	if (!isValidHandle(handle)) return null;
	const supabase = createServerSupabase() as unknown as SupabaseClient;
	return loadPublicProfile(supabase, handle);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const profile = await getProfile(params.handle);
	if (!profile) return { title: "Profile not found", robots: { index: false, follow: false } };
	const name = displayName(profile);
	const description = profile.headline ?? `${name}'s career milestones on NextMilestone.`;
	return {
		title: { absolute: `${name}: NextMilestone` },
		description,
		robots: publicProfileRobots(profile),
		alternates: { canonical: publicProfilePath(profile.handle) },
		openGraph: { title: name, description, url: publicProfilePath(profile.handle), type: "profile" },
	};
}

export default async function PublicProfilePage({ params, searchParams }: Props) {
	const profile = await getProfile(params.handle);
	if (!profile) notFound();
	return (
		<MarketingShell redirectQuery={getRedirectQuery(searchParams)}>
			<div className="nm-wrap pb-14 pt-10 md:pb-[104px] md:pt-16">
				<div className="max-w-3xl">
					<PublicProfileView profile={profile} />
				</div>
			</div>
		</MarketingShell>
	);
}
