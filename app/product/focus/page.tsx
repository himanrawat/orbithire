import type { Metadata } from "next";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { MorePages, PageFaq, PageHero, Points, SectionHead, StageGrid, TONES } from "@/components/marketing/page-kit";
import { FOCUS_FAQS } from "@/components/marketing/faq-data";
import { WeekView } from "@/components/marketing/feature-areas";
import { CinematicFocus } from "@/components/marketing/cinematic-focus";

const PATH = "/product/focus";

export const metadata: Metadata = pageMetadata(
	PATH,
	"Focus: protected time, not more reminders | NextMilestone",
	"Start a 25, 50 or 90 minute focus session tied to one task. NextMilestone holds its own notifications, plans blocks around your Google Calendar, and keeps working offline.",
);

const HOW = [
	["Pick one task", "A lesson, a practice question or an application. The session is tied to it, so the minutes mean something."],
	["Choose 25, 50 or 90", "Short for a single question, long for a project. NextMilestone holds its own notifications until you're done."],
	["Count it against your goal", "Set a weekly goal in minutes. The ring fills as you go, and an empty week isn't flagged as a failure."],
	["Plan around your week", "Connect Google Calendar and focus blocks are placed in the gaps, away from interviews and meetings."],
] as [string, string][];

const STAGE_COPY = {
	student: "25 minute blocks for lessons between classes, and a longer one for your project at the weekend.",
	early: "A daily 50 for applications and practice, kept clear of the working day.",
	experienced: "Blocks set aside for interview prep in the week before a round.",
	leader: "90 minute blocks for planning, writing and hiring work, protected on the calendar.",
};

export default function FocusPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	const redirectQuery = getRedirectQuery(searchParams);
	return (
		<MarketingShell redirectQuery={redirectQuery}>
			<PageHero
				tone={TONES.focus}
				eyebrow="Focus and schedule"
				title="Protected time,"
				muted="not more reminders."
				lead="Focus sessions tied to one task, placed around your calendar, and counted against a goal you choose. No streaks to break."
				facts={[
					["90", "Minutes at most. Sessions run 25, 50 or 90"],
					["Offline", "The timer keeps going without a connection"],
					["0", "Streaks to keep up, or to break"],
				]}
				redirectQuery={redirectQuery}
				secondary={{ label: "How it works", href: "#h-how" }}
			/>

			<section aria-labelledby="h-week" className="py-14 md:py-[104px]">
				<div className="nm-wrap">
					<SectionHead
						id="h-week"
						title="Blocks around your week."
						lead="Focus, lessons, practice and applications, each in its own color, placed in the gaps between what's already on your calendar."
					/>
					<div className="nm-grain rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3 [--grain-o:.35] md:p-6">
						<div className="relative z-[2] flex min-h-[260px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface)]">
							<WeekView />
						</div>
					</div>
				</div>
			</section>

			<Points id="h-how" title="How a session works." items={HOW} />
			<StageGrid id="h-stages" title="Time set aside for your stage." copy={STAGE_COPY} />
			<PageFaq items={FOCUS_FAQS} />
			{/* the pinned ink card ends on the closing call to action */}
			<CinematicFocus redirectQuery={redirectQuery} />
			<MorePages current={PATH} />
		</MarketingShell>
	);
}
