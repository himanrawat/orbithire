import type { Metadata } from "next";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { CtaBand, MorePages, PageFaq, PageHero, Points, StageGrid, TONES } from "@/components/marketing/page-kit";
import { PREP_FAQS } from "@/components/marketing/faq-data";
import { PrepSection } from "@/components/marketing/prep-section";

const PATH = "/product/interview-prep";

export const metadata: Metadata = pageMetadata(
	PATH,
	"Interview prep: practice what actually gets asked | NextMilestone",
	"Practice interview questions people reported after real interviews, answer by text or voice, and get AI feedback labeled as a draft: one strength, one gap, one thing to read next.",
);

const SOURCES = [
	[
		"Reported after real interviews",
		"People add the questions they were asked, with the company, role and round. “Most asked” is ranked from those reports.",
	],
	[
		"Curated sets for each role",
		"Sets for each role, grouped by the kind of round: screening, technical, system design and behavioral.",
	],
	[
		"Never scraped",
		"Every question shows where it came from. We don't copy interview content from other sites or paid question banks.",
	],
] as [string, string][];

const STAGE_COPY = {
	student: "Fundamentals and “walk me through your project” questions for internships and first roles.",
	early: "Coding rounds and the JavaScript, SQL or design questions your target roles ask most.",
	experienced: "System design and the behavioral rounds where you explain trade-offs you've made.",
	leader: "Stakeholder, hiring and strategy questions, with answers you can practice out loud.",
};

export default function InterviewPrepPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	const redirectQuery = getRedirectQuery(searchParams);
	return (
		<MarketingShell redirectQuery={redirectQuery}>
			<PageHero
				tone={TONES.prep}
				eyebrow="Interview prep"
				title="Practice what actually gets asked."
				lead="Questions people reported after real interviews, curated sets for each role, and feedback that tells you the one thing to fix next."
				facts={[
					["38", "People reported the question below after real interviews"],
					["Text", "Or voice. Answers are transcribed for you to edit"],
					["3", "Parts to every review: a strength, a gap, a next read"],
				]}
				redirectQuery={redirectQuery}
				secondary={{ label: "See a question", href: "#prep" }}
			/>
			<PrepSection />
			<Points
				id="h-sources"
				title="Every question shows its source."
				lead="You can see why a question is on your list before you spend time on it."
				items={SOURCES}
			/>
			<StageGrid id="h-stages" title="The right round for where you are." copy={STAGE_COPY} />
			<PageFaq items={PREP_FAQS} />
			<CtaBand
				redirectQuery={redirectQuery}
				title="Your next interview, practiced."
				lead="Add the role you're interviewing for and get the questions that come up most for it."
			/>
			<MorePages current={PATH} />
		</MarketingShell>
	);
}
