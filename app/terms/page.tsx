import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

// Draft — pending legal review. Covers US use, a future Pro plan's automatic renewal
// (California and other state auto-renewal laws), AI output and acceptable use
// (PRD area 11). Have counsel review before launch. Do not show this note on the page.

export const metadata: Metadata = pageMetadata(
	"/terms",
	"Terms of service | NextMilestone",
	"The agreement for using NextMilestone: accounts, acceptable use, your content, AI drafts, paid plans and liability.",
);

// Change this when the terms change, not on every deploy.
const UPDATED = "October 23, 2026";
const CONTACT_EMAIL = "info@himanshurawat.in";

function ContactEmail() {
	return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

const SECTIONS: LegalSection[] = [
	{
		id: "acceptance",
		title: "Agreeing to these terms",
		body: (
			<p>
				By creating an account or using NextMilestone, you agree to these terms and to our{" "}
				<Link href="/privacy">privacy policy</Link>. If you don&apos;t agree, please don&apos;t use the service. You
				must be at least 16 years old and able to form a binding contract.
			</p>
		),
	},
	{
		id: "service",
		title: "What NextMilestone does",
		body: (
			<p>
				NextMilestone helps you plan and run your career: a daily plan, job matches, AI-drafted resumes and cover
				letters, application tracking, learning and interview practice. We&apos;re not an employer, recruiter or
				staffing agency, and we don&apos;t guarantee interviews, offers or any job outcome. We may change, add or
				remove features; if we remove something you pay for, we&apos;ll tell you first.
			</p>
		),
	},
	{
		id: "accounts",
		title: "Your account",
		body: (
			<ul>
				<li>Give accurate information and keep it up to date</li>
				<li>Keep your password and any API keys or access tokens secure</li>
				<li>Tell us right away at <ContactEmail /> if you suspect unauthorized access</li>
				<li>You&apos;re responsible for activity under your account, including by AI assistants you connect</li>
			</ul>
		),
	},
	{
		id: "use",
		title: "Acceptable use",
		body: (
			<>
				<p>You agree not to:</p>
				<ul>
					<li>Break the law, or infringe anyone&apos;s rights</li>
					<li>Misrepresent your identity, qualifications, work history or credentials to employers</li>
					<li>
						Use NextMilestone for real-time help during a live interview, assessment or test, where the employer has
						not allowed it. Our interview practice is for preparation only, and we don&apos;t offer live-interview
						assistance.
					</li>
					<li>Scrape, overload, probe or try to break into the service or other users&apos; accounts</li>
					<li>Resell the service, or use it to build a competing product</li>
					<li>Upload malware, or content that is unlawful, harassing or that you have no right to share</li>
				</ul>
			</>
		),
	},
	{
		id: "content",
		title: "Your content",
		body: (
			<p>
				You own what you upload and what you create with NextMilestone, including generated drafts. You give us a
				limited license to host, process and display your content only to provide the service to you, as described in
				the privacy policy. You can download or delete it at any time in Settings → Data &amp; privacy. The
				NextMilestone software, design and brand remain ours.
			</p>
		),
	},
	{
		id: "ai",
		title: "AI-generated content",
		body: (
			<>
				<p>
					Resumes, cover letters, match scores, feedback and other AI output are drafts and suggestions, labeled as AI
					in the app. AI can be wrong, incomplete or out of date, and it can phrase things in ways you wouldn&apos;t.
				</p>
				<p>
					<b>You are responsible for reviewing, correcting and approving anything before you use or send it.</b> Make
					sure every claim about your experience is true. Match scores are an estimate to help you prioritize, not
					advice and not a prediction of any employer&apos;s decision. AI output is provided &quot;as is&quot;.
				</p>
			</>
		),
	},
	{
		id: "plans",
		title: "Paid plans, renewal and cancellation",
		body: (
			<>
				<p>
					NextMilestone has a Free plan and a paid Pro plan, with current prices on the{" "}
					<Link href="/pricing">pricing page</Link>. If you subscribe to Pro, these terms apply:
				</p>
				<ul>
					<li>
						<b>Automatic renewal.</b> Subscriptions renew automatically at the end of each billing period (monthly or
						yearly, as shown at checkout) and your payment method is charged the then-current price until you cancel.
						We&apos;ll show the price, billing period and renewal terms clearly before you confirm, and send a
						confirmation by email.
					</li>
					<li>
						<b>Reminders and price changes.</b> For yearly plans, we&apos;ll email you before renewal. We&apos;ll give
						you at least 30 days&apos; notice of a price increase, and you can cancel before it applies.
					</li>
					<li>
						<b>Free trials.</b> If a plan starts with a free trial, we&apos;ll tell you when it ends and what you&apos;ll
						be charged, and you can cancel before the first charge.
					</li>
					<li>
						<b>Cancel online, any time.</b> Cancel in Settings → Billing with the same ease you signed up, or email{" "}
						<ContactEmail />. Cancellation stops future renewals; you keep paid features until the end of the period
						you&apos;ve paid for.
					</li>
					<li>
						<b>Refunds.</b> Payments are non-refundable except where the law requires, or where we choose to refund at
						our discretion.
					</li>
					<li>Prices are in US dollars and exclude applicable taxes.</li>
				</ul>
			</>
		),
	},
	{
		id: "third-party",
		title: "Third-party services",
		body: (
			<p>
				Job postings link to employers&apos; sites, and you may connect your own AI provider or assistant. Those
				services have their own terms, and we&apos;re not responsible for them. We may remove a job source or listing
				at any time.
			</p>
		),
	},
	{
		id: "disclaimers",
		title: "Disclaimers",
		body: (
			<p>
				The service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent the law
				allows, we disclaim all warranties, express or implied, including merchantability, fitness for a particular
				purpose and non-infringement. We don&apos;t warrant that job listings are accurate, current or still open.
			</p>
		),
	},
	{
		id: "liability",
		title: "Limitation of liability",
		body: (
			<p>
				To the fullest extent the law allows, NextMilestone won&apos;t be liable for indirect, incidental, special,
				consequential or punitive damages, or for lost profits, opportunities or data. Our total liability for any
				claim is limited to the greater of the amount you paid us in the 12 months before the claim or US$100. Some
				states don&apos;t allow these limits, so they may not apply to you.
			</p>
		),
	},
	{
		id: "termination",
		title: "Ending your account",
		body: (
			<p>
				You can delete your account at any time in Settings → Data &amp; privacy; this permanently removes your data.
				We may suspend or close accounts that break these terms or put others at risk, and we&apos;ll tell you why
				unless the law or safety prevents it.
			</p>
		),
	},
	{
		id: "law",
		title: "Governing law and disputes",
		body: (
			<p>
				These terms are governed by the laws of the United States and the state where NextMilestone is organized,
				without regard to conflict-of-law rules. Before filing a claim, please email <ContactEmail /> so we can try to
				resolve it informally within 30 days. Nothing here limits rights you have under consumer protection laws in
				your state.
			</p>
		),
	},
	{
		id: "changes",
		title: "Changes to these terms",
		body: (
			<p>
				If we make a material change, we&apos;ll update the date above and notify you by email or in the app at least
				14 days before it takes effect. Continuing to use the service after that means you accept the new terms.
			</p>
		),
	},
	{
		id: "contact",
		title: "Contact",
		body: (
			<p>
				Questions about these terms: email <ContactEmail /> or visit our <Link href="/contact">contact page</Link>.
			</p>
		),
	},
];

export default function TermsPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	return (
		<MarketingShell redirectQuery={getRedirectQuery(searchParams)}>
			<LegalPage
				eyebrow="Terms"
				title="Terms of service."
				intro="The agreement for using NextMilestone. Plain where it can be, precise where it has to be."
				updated={UPDATED}
				sections={SECTIONS}
			/>
		</MarketingShell>
	);
}
