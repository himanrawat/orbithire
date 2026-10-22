import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell, getRedirectQuery, pageMetadata, type SearchParams } from "@/components/marketing/marketing-shell";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = pageMetadata(
	"/terms",
	"Terms of service | NextMilestone",
	"The agreement for using NextMilestone: accounts, acceptable use, your content, AI drafts and liability.",
);

// Change this when the terms change, not on every deploy.
const UPDATED = "22 October 2026";

const SECTIONS: LegalSection[] = [
	{
		id: "acceptance",
		title: "Acceptance of terms",
		body: (
			<p>
				By accessing or using NextMilestone, you agree to be bound by these Terms of Service. If you do not agree to these
				terms, please do not use our services.
			</p>
		),
	},
	{
		id: "service",
		title: "Description of service",
		body: (
			<p>
				NextMilestone provides AI-powered resume and cover letter generation, job application tracking, and career
				management tools. We reserve the right to modify, suspend, or discontinue any aspect of the service at any time.
			</p>
		),
	},
	{
		id: "accounts",
		title: "User accounts",
		body: (
			<>
				<p>To use certain features, you must create an account. You agree to:</p>
				<ul>
					<li>Provide accurate and complete information</li>
					<li>Maintain the security of your account credentials</li>
					<li>Notify us immediately of any unauthorized access</li>
					<li>Accept responsibility for all activities under your account</li>
				</ul>
			</>
		),
	},
	{
		id: "use",
		title: "Acceptable use",
		body: (
			<>
				<p>You agree not to:</p>
				<ul>
					<li>Use the service for any unlawful purpose</li>
					<li>Submit false or misleading information</li>
					<li>Attempt to gain unauthorized access to our systems</li>
					<li>Interfere with or disrupt the service</li>
					<li>Resell or redistribute the service without permission</li>
				</ul>
			</>
		),
	},
	{
		id: "ip",
		title: "Intellectual property",
		body: (
			<p>
				You retain ownership of the content you create using our service. However, you grant us a license to use, store,
				and process your content to provide and improve our services. Our platform, including its design, features, and
				code, remains our intellectual property.
			</p>
		),
	},
	{
		id: "ai",
		title: "AI-generated content",
		body: (
			<p>
				Our AI-generated resumes and cover letters are tools to assist you. You are responsible for reviewing and verifying
				the accuracy of all generated content before use. We do not guarantee that AI-generated content will result in job
				offers or interviews.
			</p>
		),
	},
	{
		id: "liability",
		title: "Limitation of liability",
		body: (
			<p>
				To the maximum extent permitted by law, NextMilestone shall not be liable for any indirect, incidental, special,
				consequential, or punitive damages arising from your use of the service.
			</p>
		),
	},
	{
		id: "termination",
		title: "Termination",
		body: (
			<p>
				We may terminate or suspend your account at any time for violations of these terms. You may delete your account at
				any time through your account settings.
			</p>
		),
	},
	{
		id: "changes",
		title: "Changes to terms",
		body: (
			<p>
				We may update these terms from time to time. We will notify you of significant changes via email or through the
				service. Continued use after changes constitutes acceptance of the new terms.
			</p>
		),
	},
	{
		id: "contact",
		title: "Contact",
		body: (
			<p>
				For questions about these Terms of Service, please visit our <Link href="/contact">contact page</Link>.
			</p>
		),
	},
];

export default function TermsPage({ searchParams }: { searchParams?: SearchParams }) {
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
