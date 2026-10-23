import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";
import { CONTACT_RETENTION_MONTHS } from "@/lib/privacy/retention";

// Draft — pending legal review. Written for CCPA/CPRA and the other US state privacy
// laws (PRD area 11); have counsel review before launch. Do not show this note on the page.

export const metadata: Metadata = pageMetadata(
	"/privacy",
	"Privacy policy | NextMilestone",
	"What NextMilestone collects, why, who processes it, your rights under US state privacy laws, and how to export or delete your data.",
);

// Change this when the policy text changes, not on every deploy.
const UPDATED = "October 23, 2026";
const PRIVACY_EMAIL = "info@himanshurawat.in";

function PrivacyEmail() {
	return <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;
}

const SECTIONS: LegalSection[] = [
	{
		id: "summary",
		title: "The short version",
		body: (
			<ul>
				<li>We collect what you give us to plan your job search, and we use it to run NextMilestone for you.</li>
				<li>
					<b>We don&apos;t sell your personal information, and we don&apos;t share it for cross-context behavioral
					advertising.</b> We never have.
				</li>
				<li>We honor Global Privacy Control signals from your browser.</li>
				<li>
					You can download your data or delete your account yourself, any time, in Settings → Data &amp; privacy.
				</li>
			</ul>
		),
	},
	{
		id: "collect",
		title: "Information we collect",
		body: (
			<>
				<p>
					<b>You give us:</b> account details (name, email, password); profile details (work history, education,
					skills, career goals, target roles and locations); resumes, cover letters and job descriptions you upload
					or paste; the applications, notes and follow-ups you track; and messages you send through our contact form.
				</p>
				<p>
					<b>Collected automatically:</b> basic technical data needed to run and secure the service, such as IP
					address, browser type, sign-in times and error logs. We use cookies that keep you signed in and remember
					your settings. We don&apos;t use advertising cookies or third-party ad trackers.
				</p>
				<p>
					<b>From other sources:</b> public job postings from employers&apos; career pages and public job APIs, used
					to find and rank roles for you. If you connect an AI assistant (for example over MCP), we receive the
					requests it makes on your behalf.
				</p>
				<p>
					We don&apos;t ask for sensitive personal information such as Social Security numbers, financial account
					numbers, health data or precise geolocation. Please leave it out of the documents you upload.
				</p>
			</>
		),
	},
	{
		id: "use",
		title: "How we use it",
		body: (
			<ul>
				<li>To run NextMilestone: your daily plan, job matches, resume and cover letter drafts, reminders and digests</li>
				<li>To keep accounts secure, prevent abuse and fix problems</li>
				<li>To answer your messages and send service emails (you can turn off the morning digest in Settings)</li>
				<li>To improve the product using aggregated, de-identified usage information</li>
				<li>To meet legal obligations</li>
			</ul>
		),
	},
	{
		id: "ai",
		title: "AI features",
		body: (
			<>
				<p>
					When you ask for a draft (a resume, cover letter or profile import), we send the relevant parts of your
					profile and the job post to an AI model provider to generate it. If you add your own API key, the request
					goes to the provider you chose under your account with them.
				</p>
				<p>
					Every AI-generated item is labeled in the app. We log which model and prompt version produced it so we can
					explain and improve results. We don&apos;t use your documents to train our own models, and we use AI
					providers whose terms do not allow them to train on data sent through their business APIs.
				</p>
				<p>
					Match scores help you decide where to spend your time. They are not decisions about you, and we don&apos;t
					share them with employers.
				</p>
			</>
		),
	},
	{
		id: "sharing",
		title: "Who we share it with",
		body: (
			<>
				<p>
					We share personal information only with service providers that process it for us under contract, and only
					as needed to run NextMilestone:
				</p>
				<ul>
					<li>Hosting, database and file storage providers</li>
					<li>AI model providers, for the drafts you request</li>
					<li>Our email delivery provider, for service emails and digests</li>
					<li>A bot-protection provider on sign-up and contact forms</li>
				</ul>
				<p>
					We may also disclose information when the law requires it, to protect people&apos;s safety or our rights, or
					as part of a merger or sale of the business (with notice to you). We don&apos;t sell personal information
					or share it for targeted advertising, and we have no actual knowledge of selling or sharing the data of
					anyone under 16.
				</p>
			</>
		),
	},
	{
		id: "gpc",
		title: "Global Privacy Control",
		body: (
			<p>
				If your browser sends a Global Privacy Control (GPC) signal, we treat it as a valid request to opt out of the
				sale or sharing of your personal information, and we turn off any non-essential analytics for that browser.
				Since we don&apos;t sell or share personal information, the opt-out is already in effect for everyone; GPC
				simply confirms it. You can see whether we detect the signal in Settings → Data &amp; privacy.
			</p>
		),
	},
	{
		id: "rights",
		title: "Your US state privacy rights",
		body: (
			<>
				<p>
					Residents of California (CCPA as amended by the CPRA) and of other states with consumer privacy laws,
					including Colorado, Connecticut, Delaware, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska,
					New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah and Virginia, have some or all of
					these rights. We extend them to every user, wherever you live in the US:
				</p>
				<ul>
					<li><b>Know and access:</b> what we collect, why, and a copy of it</li>
					<li><b>Portability:</b> your data in a portable, machine-readable format (JSON)</li>
					<li><b>Correct:</b> fix inaccurate information</li>
					<li><b>Delete:</b> remove your account and the data we hold about you</li>
					<li><b>Opt out</b> of sale, sharing, targeted advertising and profiling with legal or similar effects (we do none of these)</li>
					<li><b>Limit</b> the use of sensitive personal information (we don&apos;t collect it on purpose)</li>
					<li><b>Non-discrimination:</b> we won&apos;t treat you differently for using these rights</li>
				</ul>
				<p>
					<b>How to use them:</b> download your data or delete your account in Settings → Data &amp; privacy, or edit
					your profile directly. For anything else, email <PrivacyEmail /> with the subject &quot;Privacy
					request&quot;. We&apos;ll confirm within 10 business days and respond within 45 days (we may extend once by
					another 45 days and will tell you why). To protect you, we verify requests by matching them to the email on
					your account. An authorized agent may act for you with your signed permission.
				</p>
				<p>
					<b>Appeals:</b> if we decline a request, you can appeal by replying to our decision. We&apos;ll answer
					within the time your state law requires. If you&apos;re not satisfied, you can contact your state attorney
					general.
				</p>
			</>
		),
	},
	{
		id: "retention",
		title: "How long we keep it",
		body: (
			<ul>
				<li>Account data: while your account is open. Deleting your account removes it, along with your stored files.</li>
				<li>Contact form messages: up to {CONTACT_RETENTION_MONTHS} months, then deleted automatically.</li>
				<li>Security logs and backups: kept for a short period, then overwritten on a rolling basis.</li>
				<li>Anything we must keep longer to meet a legal obligation, only for as long as required.</li>
			</ul>
		),
	},
	{
		id: "security",
		title: "Security",
		body: (
			<p>
				We use encryption in transit, encryption of stored API keys, access controls and row-level security so each
				account can only reach its own data. No system is perfectly secure; if a breach affects your information,
				we&apos;ll notify you as the law requires.
			</p>
		),
	},
	{
		id: "children",
		title: "Children",
		body: (
			<p>
				NextMilestone is for people 16 and older. We don&apos;t knowingly collect personal information from children
				under 13. If you believe a child has given us information, email <PrivacyEmail /> and we&apos;ll delete it.
			</p>
		),
	},
	{
		id: "changes",
		title: "Changes to this policy",
		body: (
			<p>
				If we make a material change, we&apos;ll update the date above and tell you by email or in the app before it
				takes effect.
			</p>
		),
	},
	{
		id: "contact",
		title: "Contact us",
		body: (
			<p>
				Questions or requests: email <PrivacyEmail /> or use <Link href="/contact">our contact page</Link>.
			</p>
		),
	},
];

export default function PrivacyPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	return (
		<MarketingShell redirectQuery={getRedirectQuery(searchParams)}>
			<LegalPage
				eyebrow="Privacy"
				title="Privacy policy."
				intro="What NextMilestone collects, why we collect it, and how you can take it with you or delete it."
				updated={UPDATED}
				sections={SECTIONS}
			/>
		</MarketingShell>
	);
}
