import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
	return (
		<div className="relative min-h-screen bg-background">
			<NavBar />

			<main className="container max-w-4xl py-12">
				<Link
					href="/"
					className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
				>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to home
				</Link>

				<h1 className="text-4xl font-bold tracking-tight mb-8">Privacy Policy</h1>

				<div className="prose prose-gray dark:prose-invert max-w-none">
					<p className="text-muted-foreground text-lg mb-8">
						Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
					</p>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
						<p className="text-muted-foreground mb-4">
							We collect information you provide directly to us, including:
						</p>
						<ul className="list-disc pl-6 text-muted-foreground space-y-2">
							<li>Account information (name, email address, password)</li>
							<li>Profile information (work experience, education, skills)</li>
							<li>Resume content and job descriptions you upload</li>
							<li>Company and job application tracking data</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
						<p className="text-muted-foreground mb-4">
							We use the information we collect to:
						</p>
						<ul className="list-disc pl-6 text-muted-foreground space-y-2">
							<li>Provide, maintain, and improve our services</li>
							<li>Generate AI-powered resumes and cover letters</li>
							<li>Send you notifications and reminders</li>
							<li>Respond to your comments and questions</li>
							<li>Protect against fraudulent or illegal activity</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">3. Data Security</h2>
						<p className="text-muted-foreground">
							We implement appropriate technical and organizational measures to protect your personal
							information against unauthorized access, alteration, disclosure, or destruction. Your data
							is encrypted in transit and at rest.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">4. Data Retention</h2>
						<p className="text-muted-foreground">
							We retain your personal information for as long as your account is active or as needed to
							provide you services. You can request deletion of your account and associated data at any
							time through your account settings.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">5. Third-Party Services</h2>
						<p className="text-muted-foreground">
							We may use third-party services for authentication, payment processing, and AI capabilities.
							These services have their own privacy policies governing the use of your information.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
						<p className="text-muted-foreground mb-4">
							You have the right to:
						</p>
						<ul className="list-disc pl-6 text-muted-foreground space-y-2">
							<li>Access your personal data</li>
							<li>Correct inaccurate data</li>
							<li>Request deletion of your data</li>
							<li>Export your data in a portable format</li>
							<li>Opt out of marketing communications</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">7. Contact Us</h2>
						<p className="text-muted-foreground">
							If you have any questions about this Privacy Policy, please contact us at{" "}
							<Link href="/contact" className="text-primary hover:underline">
								our contact page
							</Link>
							.
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
