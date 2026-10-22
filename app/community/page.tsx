import type { Metadata } from "next";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { CtaBand, MorePages, PageFaq, PageHero, Points, SectionHead, TONES } from "@/components/marketing/page-kit";
import { COMMUNITY_FAQS } from "@/components/marketing/faq-data";
import { CommunitySection } from "@/components/marketing/community-section";
import { MilestoneRoad } from "@/components/marketing/feature-areas";

const PATH = "/community";

export const metadata: Metadata = pageMetadata(
	PATH,
	"Community: advice from a few steps ahead | NextMilestone",
	"Share the milestones you choose, ask people a few steps ahead, and read advice ranked by how helpful it was. No like counts, no follower counts.",
);

const RULES = [
	["Helpful, not likes", "Posts are ranked by how many people found them helpful. The count sits on the post, never on the person."],
	["No follower counts", "Nobody has a number next to their name, so a first-year student's question gets read like anyone else's."],
	["Public or private, per milestone", "Each milestone has its own setting. “Open to roles” is only ever visible to you."],
	["Invite-only at launch", "The community opens in small groups so the first conversations set the tone."],
] as [string, string][];

export default function CommunityPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	const redirectQuery = getRedirectQuery(searchParams);
	return (
		<MarketingShell redirectQuery={redirectQuery}>
			<PageHero
				tone={TONES.community}
				eyebrow="Community and milestones"
				title="Advice from a few steps ahead."
				lead="A record of what you shipped, shared on your terms, and a place to ask the people who were where you are a year or two ago."
				facts={[
					["0", "Like counts or follower counts"],
					["1", "Setting per milestone: public or private"],
					["4", "Career stages, shown on every post"],
				]}
				redirectQuery={redirectQuery}
				secondary={{ label: "See a profile", href: "#community" }}
			/>
			<CommunitySection />

			<section aria-labelledby="h-road" className="py-14 md:py-[104px]">
				<div className="nm-wrap">
					<SectionHead
						id="h-road"
						title="A record of what you shipped."
						lead="Finished a path, shipped a project, ran your first hiring round: each one becomes a milestone on your profile."
					/>
					<div className="nm-grain rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3 [--grain-o:.35] md:p-6">
						<div className="relative z-[2] flex h-[240px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)] md:h-[300px]">
							<MilestoneRoad />
						</div>
					</div>
				</div>
			</section>

			<Points id="h-rules" title="How the community works." items={RULES} />
			<PageFaq items={COMMUNITY_FAQS} />
			<CtaBand
				redirectQuery={redirectQuery}
				title="Start your record today."
				lead="Sign up, add your first milestone and keep it private until you're ready."
			/>
			<MorePages current={PATH} />
		</MarketingShell>
	);
}
