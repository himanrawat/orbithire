import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = pageMetadata(
	"/privacy",
	"Privacy policy | NextMilestone",
	"What NextMilestone stores, why, how it's protected, and how to export or delete your data.",
);

// Change this when the policy text changes, not on every deploy.
const UPDATED = "22 October 2026";

const SECTIONS: LegalSection[] = [
	{
		id: "collect",
		title: "Information we collect",
		body: (
			<>
				<p>We collect information you provide directly to us, including:</p>
				<ul>
					<li>Account information (name, email address, password)</li>
					<li>Profile information (work experience, education, skills)</li>
					<li>Resume content and job descriptions you upload</li>
					<li>Company and job application tracking data</li>
				</ul>
			</>
		),
	},
	{
		id: "use",
		title: "How we use your information",
		body: (
			<>
				<p>We use the information we collect to:</p>
				<ul>
					<li>Provide, maintain, and improve our services</li>
					<li>Generate AI-powered resumes and cover letters</li>
					<li>Send you notifications and reminders</li>
					<li>Respond to your comments and questions</li>
					<li>Protect against fraudulent or illegal activity</li>
				</ul>
			</>
		),
	},
	{
		id: "security",
		title: "Data security",
		body: (
			<p>
				We implement appropriate technical and organizational measures to protect your personal information against
				unauthorized access, alteration, disclosure, or destruction. Your data is encrypted in transit and at rest.
			</p>
		),
	},
	{
		id: "retention",
		title: "Data retention",
		body: (
			<p>
				We retain your personal information for as long as your account is active or as needed to provide you services.
				You can request deletion of your account and associated data at any time through your account settings.
			</p>
		),
	},
	{
		id: "third-parties",
		title: "Third-party services",
		body: (
			<p>
				We may use third-party services for authentication, payment processing, and AI capabilities. These services have
				their own privacy policies governing the use of your information.
			</p>
		),
	},
	{
		id: "rights",
		title: "Your rights",
		body: (
			<>
				<p>You have the right to:</p>
				<ul>
					<li>Access your personal data</li>
					<li>Correct inaccurate data</li>
					<li>Request deletion of your data</li>
					<li>Export your data in a portable format</li>
					<li>Opt out of marketing communications</li>
				</ul>
			</>
		),
	},
	{
		id: "contact",
		title: "Contact us",
		body: (
			<p>
				If you have any questions about this Privacy Policy, please contact us through{" "}
				<Link href="/contact">our contact page</Link>.
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
				intro="What NextMilestone stores, why we store it, and how you can take it with you or delete it."
				updated={UPDATED}
				sections={SECTIONS}
			/>
		</MarketingShell>
	);
}
