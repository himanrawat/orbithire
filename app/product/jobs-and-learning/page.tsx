import type { Metadata } from "next";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { CtaBand, Eyebrow, MorePages, Notes, PageFaq, PageHero, Points, StageGrid, TONES } from "@/components/marketing/page-kit";
import { JOBS_FAQS } from "@/components/marketing/faq-data";
import { MatchList, SkillGrid } from "@/components/marketing/feature-areas";

const PATH = "/product/jobs-and-learning";

export const metadata: Metadata = pageMetadata(
	PATH,
	"Jobs and learning: matches every morning, skills they ask for | NextMilestone",
	"NextMilestone fetches jobs from about 30 sources every morning, scores them against your profile, tailors a resume when you shortlist one, and points you to the skill your best matches ask for.",
);

const LOOP = [
	["Matches arrive at 7:00 AM", "Jobs from about 30 sources are fetched, de-duplicated and scored against your profile overnight."],
	["Shortlist the ones that fit", "Today shows the best three. Shortlist one and you get a tailored resume draft for it to review."],
	["Learn what they ask for", "The skill that comes up most across your shortlist is picked out, with a path to learn it."],
	["You apply, not a bot", "Nothing is sent for you. NextMilestone never applies to jobs on your behalf."],
] as [string, string][];

const STAGE_COPY = {
	student: "Internships and graduate roles, and the launch path that gets you ready for them.",
	early: "Roles a step up from where you are, scored on the skills you can already show.",
	experienced: "Senior roles filtered by pay band and location, with the gaps between you and them named.",
	leader: "Fewer, better matches for leadership roles, and learning on hiring and strategy.",
};

export default function JobsAndLearningPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	const redirectQuery = getRedirectQuery(searchParams);
	return (
		<MarketingShell redirectQuery={redirectQuery}>
			<PageHero
				tone={TONES.jobs}
				eyebrow="Jobs and learning"
				title="The right roles,"
				muted="and the skills they ask for."
				lead="Every morning NextMilestone finds new roles, scores them against your profile and shows you the best three. Then it shows you what to learn to close the gap."
				facts={[
					["7 AM", "New matches, fetched and scored overnight"],
					["~30", "Job sources, with duplicates merged"],
					["4", "Learning paths at launch"],
				]}
				redirectQuery={redirectQuery}
				secondary={{ label: "See a morning's matches", href: "#jobs" }}
			/>

			<section id="jobs" aria-labelledby="h-jobs" className="py-14 md:py-[104px]">
				<div className="nm-wrap grid items-center gap-10 lg:grid-cols-[5fr_6fr] lg:gap-16">
					<div>
						<Eyebrow tone={TONES.jobs}>Jobs</Eyebrow>
						<h2 id="h-jobs" className="nm-h2 mt-5">
							Ranked for you, not for clicks.
						</h2>
						<p className="nm-lead mt-5">
							The best three new matches, scored against your profile, with the pay range up front. Shortlist one and get a
							tailored resume to review.
						</p>
					</div>
					<div className="nm-grain rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3 [--grain-o:.35] md:p-6">
						<div className="relative z-[2] flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)]">
							<MatchList />
						</div>
					</div>
				</div>
			</section>

			<section id="learn" aria-labelledby="h-learn" className="py-14 md:py-[104px]">
				<div className="nm-wrap grid items-center gap-10 lg:grid-cols-[6fr_5fr] lg:gap-16">
					<div className="nm-grain rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3 [--grain-o:.35] max-lg:order-2 md:p-6">
						<div className="relative z-[2] flex min-h-[300px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)]">
							<SkillGrid />
						</div>
					</div>
					<div>
						<Eyebrow tone={TONES.learn}>Learn</Eyebrow>
						<h2 id="h-learn" className="nm-h2 mt-5">
							Learn the skill your matches ask for.
						</h2>
						<p className="nm-lead mt-5">
							The skill that comes up most in the roles you shortlisted is picked out, with short lessons that fit in a
							focus block.
						</p>
					</div>
				</div>
				<div className="nm-wrap pt-14">
					<Notes
						items={[
							["Skills you have stay lit,", "the ones you're missing are faded, and the next one is marked."],
							["Lessons are short,", "most between 8 and 15 minutes, so they fit around work."],
							["Log what you learn elsewhere,", "and it counts on your profile the same way."],
						]}
					/>
				</div>
			</section>

			<Points id="h-loop" title="From a match to a skill." items={LOOP} />
			<StageGrid id="h-stages" title="Roles that fit your stage." copy={STAGE_COPY} />
			<PageFaq items={JOBS_FAQS} />
			<CtaBand
				redirectQuery={redirectQuery}
				title="Tomorrow's matches, scored for you."
				lead="Import a resume and set where you want to work. Your first matches arrive the next morning."
			/>
			<MorePages current={PATH} />
		</MarketingShell>
	);
}
