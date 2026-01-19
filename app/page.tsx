import Image from "next/image";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GridBackground, Spotlight } from "@/components/ui/aceternity";
import {
	FileText,
	FolderOpen,
	Bell,
	ArrowRight,
	CheckCircle2,
	Briefcase,
	Clock,
	Sparkles,
	PenLine,
	Mail,
} from "lucide-react";
import { sanitizeRedirect } from "@/lib/auth-utils";

type SearchParams = {
	[key: string]: string | string[] | undefined;
};

const features = [
	{
		title: "ATS-Ready Resumes",
		description:
			"Paste a job description and get a tailored, ATS-optimized resume in seconds. Powered by AI to match keywords and formatting.",
		icon: <FileText className="h-5 w-5" />,
	},
	{
		title: "Company Folders",
		description:
			"Organize everything by company. Store multiple resume versions, cover letters, JD notes, and interview prep in one place.",
		icon: <FolderOpen className="h-5 w-5" />,
	},
	{
		title: "Smart Follow-ups",
		description:
			"Never miss a follow-up. Get automated reminders and professionally crafted messages ready to send after 7 days.",
		icon: <Bell className="h-5 w-5" />,
	},
];

const benefits = [
	"Save hours on every application",
	"Beat ATS screening algorithms",
	"Stay organized across companies",
	"Professional follow-up templates",
	"EU/DE resume templates included",
	"Track all your applications",
];

const trackerItems = [
	{
		company: "Google",
		role: "Senior Frontend Engineer",
		status: "Applied",
		days: "7 days ago",
	},
	{
		company: "Siemens",
		role: "Software Engineer",
		status: "Interview",
		days: "2 days ago",
	},
	{
		company: "SAP",
		role: "Product Engineer",
		status: "Saved",
		days: "today",
	},
];

const faqEntries = [
	{
		question: "How does CVLeap beat ATS filters?",
		answer:
			"We analyze your job description, align skills and keywords, and format resumes to stay parseable by ATS scanners.",
	},
	{
		question: "Do you generate cover letters too?",
		answer:
			"Yes. Paste the JD and your profile once, and we generate tailored cover letters alongside your resumes.",
	},
	{
		question: "Can I manage multiple applications?",
		answer:
			"Use company folders to keep resumes, notes, follow-ups, and interview prep organized per opportunity.",
	},
	{
		question: "Is there a free plan?",
		answer:
			"You can start for free. Upgrade when you need more exports, advanced templates, or collaboration.",
	},
];

const structuredData = {
	organization: {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "CVLeap AI",
		url: "https://resume.himanshurawat.in",
		logo: "https://resume.himanshurawat.in/OG.png",
	},
	product: {
		"@context": "https://schema.org",
		"@type": "Product",
		name: "CVLeap AI",
		description:
			"ATS-ready resume builder with company folders, AI cover letters, and automated follow-ups.",
		brand: {
			"@type": "Organization",
			name: "CVLeap AI",
		},
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			priceValidUntil: "2026-12-31",
			url: "https://resume.himanshurawat.in/signup",
		},
	},
	faq: {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqEntries.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: faq.answer,
			},
		})),
	},
};

export default function LandingPage({
	searchParams,
}: {
	searchParams?: SearchParams;
}) {
	const redirectParam = searchParams?.redirect;
	const redirectValue = Array.isArray(redirectParam)
		? redirectParam[0]
		: redirectParam || null;

	const safeRedirect = sanitizeRedirect(redirectValue, "");
	const redirectQuery = safeRedirect
		? `?redirect=${encodeURIComponent(safeRedirect)}`
		: "";

	return (
		<div className="min-h-screen">
			<NavBar user={null} />
			<GridBackground />
			<Spotlight
				className="-top-40 left-0 md:left-60 md:-top-20"
				fill="currentColor"
			/>

			{/* SEO structured data */}
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
			/>

			{/* Hero Section */}
			<section className="relative">
				<div className="container px-4 py-24 md:py-32 lg:py-40">
					<div className="mx-auto max-w-4xl text-center">
						<div className="mb-6 flex flex-wrap items-center justify-center gap-2">
							{["ATS Ready", "Company Folders", "Auto Follow-ups"].map(
								(tag) => (
									<span
										key={tag}
										className="rounded-full border bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground"
									>
										{tag}
									</span>
								)
							)}
						</div>
						<h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
							Keep every application{" "}
							<span className="text-muted-foreground">tight, tailored,</span>{" "}
							and tracked
						</h1>
						<p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
							Paste a job description, auto-generate ATS-friendly resumes and
							cover letters, organize them by company, and never forget to
							follow up.
						</p>
						<div className="flex flex-wrap items-center justify-center gap-4">
							<Button size="lg" asChild>
								<Link href={`/signup${redirectQuery}`}>
									Get started free
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="/dashboard">View demo</Link>
							</Button>
						</div>
						<div className="mt-10 flex justify-center">
							<div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border bg-background/60 shadow-lg">
								<Image
									src="/dashboard.png"
									alt="CVLeap AI ATS resume builder preview"
									width={1200}
									height={630}
									priority
									className="h-auto w-full object-cover"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="relative border-t bg-muted/30">
				<div className="container px-4 py-24">
					<div className="mb-12 text-center">
						<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
							Everything you need to land the job
						</h2>
						<p className="mx-auto max-w-2xl text-muted-foreground">
							Streamline your job search with powerful tools designed to help
							you stand out.
						</p>
					</div>

					<div className="grid gap-6 md:grid-cols-3">
						{features.map((feature) => (
							<div key={feature.title}>
								<Card className="h-full border-border/50 bg-card/50 backdrop-blur transition-colors hover:bg-card/80">
									<CardHeader>
										<div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											{feature.icon}
										</div>
										<CardTitle className="text-xl">{feature.title}</CardTitle>
									</CardHeader>
									<CardContent>
										<CardDescription className="text-base">
											{feature.description}
										</CardDescription>
									</CardContent>
								</Card>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* SEO Content Section */}
			<section className="border-t">
				<div className="container grid gap-10 px-4 py-24 lg:grid-cols-2 lg:items-center">
					<div className="space-y-6">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							ATS resume builder, AI cover letters, and a job application
							tracker in one place
						</h2>
						<p className="text-muted-foreground">
							CVLeap AI is built to beat ATS scanners, tailor every resume to a
							specific job description, and keep your pipeline organized. No
							more copy-pasting into documents or losing track of follow-ups.
						</p>
						<div className="space-y-3">
							<div className="flex items-start gap-3">
								<FileText className="mt-1 h-5 w-5 text-primary" />
								<div>
									<p className="font-medium">ATS resume builder</p>
									<p className="text-sm text-muted-foreground">
										Keyword alignment, clean formatting, and PDF output that
										stays parseable by popular applicant tracking systems.
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<PenLine className="mt-1 h-5 w-5 text-primary" />
								<div>
									<p className="font-medium">AI cover letter generator</p>
									<p className="text-sm text-muted-foreground">
										Tailored cover letters that mirror the job description and
										highlight your matched skills automatically.
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<Briefcase className="mt-1 h-5 w-5 text-primary" />
								<div>
									<p className="font-medium">Job application tracker</p>
									<p className="text-sm text-muted-foreground">
										Company folders to store resumes, notes, and interview prep
										for every opportunity.
									</p>
								</div>
							</div>
							<div className="flex items-start gap-3">
								<Mail className="mt-1 h-5 w-5 text-primary" />
								<div>
									<p className="font-medium">Follow-up email templates</p>
									<p className="text-sm text-muted-foreground">
										Automated reminders with ready-to-send follow-up messages so
										you never miss the 7-day check-in.
									</p>
								</div>
							</div>
						</div>
					</div>

					<Card className="border-border/50 bg-card/50 backdrop-blur">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-lg">
								<Briefcase className="h-5 w-5" />
								Application Tracker
							</CardTitle>
							<CardDescription>
								Stay on top of every opportunity with status and follow-ups.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-3">
								{trackerItems.map((item) => (
									<div
										key={item.company + item.role}
										className="flex items-center justify-between rounded-lg border bg-background/50 p-3"
									>
										<div>
											<p className="font-medium">{item.company}</p>
											<p className="text-sm text-muted-foreground">
												{item.role}
											</p>
										</div>
										<div className="text-right">
											<span className="inline-block rounded-full bg-secondary px-2 py-1 text-xs font-medium">
												{item.status}
											</span>
											<p className="mt-1 text-xs text-muted-foreground">
												{item.days}
											</p>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="relative border-t">
				<div className="container px-4 py-24">
					<div className="grid gap-12 lg:grid-cols-2 lg:items-center">
						<div>
							<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
								Why job seekers love CVLeap AI
							</h2>
							<p className="mb-8 text-muted-foreground">
								Join thousands of professionals who have streamlined their job
								search and landed their dream roles.
							</p>
							<ul className="grid gap-3 sm:grid-cols-2">
								{benefits.map((benefit) => (
									<li key={benefit} className="flex items-center gap-2">
										<CheckCircle2 className="h-5 w-5 text-primary" />
										<span className="text-sm">{benefit}</span>
									</li>
								))}
							</ul>
						</div>
						<Card className="border-border/50 bg-card/50 backdrop-blur">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<Sparkles className="h-5 w-5" />
									Proof you can ship faster
								</CardTitle>
								<CardDescription>
									Less time formatting, more time applying to the right roles.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<p>
									Resume and cover letter drafts in minutes, not hours. Keep a
									history per company so you can reuse the best-performing
									versions.
								</p>
								<p>
									Follow-up reminders land automatically, so you never miss the
									7-day nudge that often re-opens conversations.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="border-t bg-muted/30">
				<div className="container px-4 py-20">
					<div className="mb-8 text-center">
						<h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
							Questions about ATS resumes and follow-ups
						</h2>
						<p className="mt-2 text-muted-foreground">
							Everything you need to know before you start with CVLeap AI.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						{faqEntries.map((faq) => (
							<Card key={faq.question} className="border-border/50 bg-card/60">
								<CardHeader>
									<CardTitle className="text-base font-semibold">
										{faq.question}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-sm text-muted-foreground">{faq.answer}</p>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="relative border-t">
				<div className="container px-4 py-24">
					<div className="mx-auto max-w-2xl text-center">
						<div className="mb-4 flex justify-center">
							<Sparkles className="h-10 w-10 text-primary" />
						</div>
						<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
							Ready to supercharge your job search?
						</h2>
						<p className="mb-8 text-muted-foreground">
							Join CVLeap AI today and start landing more interviews with less
							effort.
						</p>
						<div className="flex flex-wrap items-center justify-center gap-4">
							<Button size="lg" asChild>
								<Link href={`/signup${redirectQuery}`}>
									Create free account
									<ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t">
				<div className="container flex flex-col items-center justify-between gap-4 py-10 md:flex-row">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<span>© {new Date().getFullYear()} CVLeap AI. All rights reserved.</span>
					</div>
					<div className="flex gap-6 text-sm text-muted-foreground">
						<Link href="/privacy" className="transition-colors hover:text-foreground">
							Privacy
						</Link>
						<Link href="/terms" className="transition-colors hover:text-foreground">
							Terms
						</Link>
						<Link href="/contact" className="transition-colors hover:text-foreground">
							Contact
						</Link>
						<Link href="/admin/signin" className="transition-colors hover:text-foreground">
							Admin
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
