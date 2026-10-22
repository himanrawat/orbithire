import type { Metadata } from "next";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { CtaBand, MorePages, PageFaq, PageHero, Points, StageGrid, TONES } from "@/components/marketing/page-kit";
import { TODAY_FAQS } from "@/components/marketing/faq-data";
import { TodaySection } from "@/components/marketing/today-section";

const PATH = "/product/today";

export const metadata: Metadata = pageMetadata(
	PATH,
	"Today: one next step, with the reason | NextMilestone",
	"Today replaces the dashboard of counts with the single most useful career step, the reason it comes first, and a short plan of 3 to 5 items made each morning.",
);

const HOW = [
	[
		"It reads what's coming up",
		"Interviews on your calendar, lessons you've started, jobs you shortlisted and the focus time you set aside.",
	],
	[
		"It picks one thing, and says why",
		"The next step names its reason: “Round 2 is on Friday and you haven't practiced system design yet.”",
	],
	[
		"You take it, or move it aside",
		"Start it, or tap “Not today”. The plan learns what you skip, and nothing is counted against you.",
	],
] as [string, string][];

const STAGE_COPY = {
	student: "Lessons on the path you picked and practice for a first internship. Applications come later.",
	early: "New matches, tailored resumes and follow-ups, with practice for the interviews they lead to.",
	experienced: "Interview rounds come first when one is near. Otherwise, the skill your best matches ask for.",
	leader: "Milestones worth recording, mentoring requests and long focus blocks for planning work.",
};

export default function TodayPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	const redirectQuery = getRedirectQuery(searchParams);
	return (
		<MarketingShell redirectQuery={redirectQuery}>
			<PageHero
				tone={TONES.today}
				eyebrow="Today"
				title="One next step."
				muted="With the reason."
				lead="Every morning NextMilestone reads your interviews, your learning and your job matches, and puts the most useful thing at the top of the screen."
				facts={[
					["6:30 AM", "Your plan is ready before you are"],
					["3–5", "Items a day, never a wall of tasks"],
					["3", "Best new job matches, scored for you"],
				]}
				redirectQuery={redirectQuery}
				secondary={{ label: "See the screen", href: "#today" }}
			/>
			<TodaySection />
			<Points id="h-how" title="How it decides." lead="Three steps, every morning, and you can see the reasoning for each." items={HOW} />
			<StageGrid
				id="h-stages"
				title="Same screen, different first step."
				lead="Your career stage changes what Today leads with, not where things are."
				copy={STAGE_COPY}
			/>
			<PageFaq items={TODAY_FAQS} />
			<CtaBand
				redirectQuery={redirectQuery}
				title="Your first plan is two minutes away."
				lead="Pick your stage and what you're working towards. Tomorrow at 6:30 AM, your first plan will be waiting."
			/>
			<MorePages current={PATH} />
		</MarketingShell>
	);
}
