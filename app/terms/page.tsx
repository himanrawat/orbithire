import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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

				<h1 className="text-4xl font-bold tracking-tight mb-8">Terms of Service</h1>

				<div className="prose prose-gray dark:prose-invert max-w-none">
					<p className="text-muted-foreground text-lg mb-8">
						Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
					</p>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
						<p className="text-muted-foreground">
							By accessing or using CVLeap AI, you agree to be bound by these Terms of Service. If you
							do not agree to these terms, please do not use our services.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
						<p className="text-muted-foreground">
							CVLeap AI provides AI-powered resume and cover letter generation, job application tracking,
							and career management tools. We reserve the right to modify, suspend, or discontinue any
							aspect of the service at any time.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
						<p className="text-muted-foreground mb-4">
							To use certain features, you must create an account. You agree to:
						</p>
						<ul className="list-disc pl-6 text-muted-foreground space-y-2">
							<li>Provide accurate and complete information</li>
							<li>Maintain the security of your account credentials</li>
							<li>Notify us immediately of any unauthorized access</li>
							<li>Accept responsibility for all activities under your account</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
						<p className="text-muted-foreground mb-4">
							You agree not to:
						</p>
						<ul className="list-disc pl-6 text-muted-foreground space-y-2">
							<li>Use the service for any unlawful purpose</li>
							<li>Submit false or misleading information</li>
							<li>Attempt to gain unauthorized access to our systems</li>
							<li>Interfere with or disrupt the service</li>
							<li>Resell or redistribute the service without permission</li>
						</ul>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
						<p className="text-muted-foreground">
							You retain ownership of the content you create using our service. However, you grant us a
							license to use, store, and process your content to provide and improve our services. Our
							platform, including its design, features, and code, remains our intellectual property.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">6. AI-Generated Content</h2>
						<p className="text-muted-foreground">
							Our AI-generated resumes and cover letters are tools to assist you. You are responsible for
							reviewing and verifying the accuracy of all generated content before use. We do not guarantee
							that AI-generated content will result in job offers or interviews.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
						<p className="text-muted-foreground">
							To the maximum extent permitted by law, CVLeap AI shall not be liable for any indirect,
							incidental, special, consequential, or punitive damages arising from your use of the service.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
						<p className="text-muted-foreground">
							We may terminate or suspend your account at any time for violations of these terms. You may
							delete your account at any time through your account settings.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
						<p className="text-muted-foreground">
							We may update these terms from time to time. We will notify you of significant changes via
							email or through the service. Continued use after changes constitutes acceptance of the new terms.
						</p>
					</section>

					<section className="mb-8">
						<h2 className="text-2xl font-semibold mb-4">10. Contact</h2>
						<p className="text-muted-foreground">
							For questions about these Terms of Service, please visit our{" "}
							<Link href="/contact" className="text-primary hover:underline">
								contact page
							</Link>
							.
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
