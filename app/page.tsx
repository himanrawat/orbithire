"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { sanitizeRedirect } from "@/lib/auth-utils";

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

function LandingPageContent() {
	const user = null;
	const searchParams = useSearchParams();

	const safeRedirect = sanitizeRedirect(searchParams.get("redirect"), "");
	const redirectQuery = safeRedirect
		? `?redirect=${encodeURIComponent(safeRedirect)}`
		: "";

	return (
		<div className="min-h-screen">
			<NavBar user={user} />
			<GridBackground />
			<Spotlight
				className="-top-40 left-0 md:left-60 md:-top-20"
				fill="currentColor"
			/>

			{/* Hero Section */}
			<section className="relative">
				<div className="container px-4 py-24 md:py-32 lg:py-40">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
						className="mx-auto max-w-4xl text-center"
					>
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
					</motion.div>
				</div>
			</section>

			{/* Features Section */}
			<section className="relative border-t bg-muted/30">
				<div className="container px-4 py-24">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5 }}
						className="mb-12 text-center"
					>
						<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
							Everything you need to land the job
						</h2>
						<p className="mx-auto max-w-2xl text-muted-foreground">
							Streamline your job search with powerful tools designed to help
							you stand out.
						</p>
					</motion.div>

					<div className="grid gap-6 md:grid-cols-3">
						{features.map((feature, index) => (
							<motion.div
								key={feature.title}
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.5, delay: index * 0.1 }}
							>
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
							</motion.div>
						))}
					</div>
				</div>
			</section>

			{/* Benefits Section */}
			<section className="relative border-t">
				<div className="container px-4 py-24">
					<div className="grid gap-12 lg:grid-cols-2 lg:items-center">
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
						>
							<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
								Why job seekers love OrbitHire
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
						</motion.div>

						<motion.div
							initial={{ opacity: 0, x: 20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
						>
							<Card className="border-border/50 bg-card/50 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<Briefcase className="h-5 w-5" />
										Application Tracker
									</CardTitle>
									<CardDescription>
										Stay on top of every opportunity
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
						</motion.div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="relative border-t bg-muted/30">
				<div className="container px-4 py-24">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5 }}
						className="mx-auto max-w-2xl text-center"
					>
						<div className="mb-4 flex justify-center">
							<Sparkles className="h-10 w-10 text-primary" />
						</div>
						<h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
							Ready to supercharge your job search?
						</h2>
						<p className="mb-8 text-muted-foreground">
							Join OrbitHire today and start landing more interviews with less
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
					</motion.div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t">
				<div className="container flex flex-col items-center justify-between gap-4 py-10 md:flex-row">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Clock className="h-4 w-4" />
						<span>© 2024 OrbitHire. All rights reserved.</span>
					</div>
					<div className="flex gap-6 text-sm text-muted-foreground">
						<Link href="#" className="hover:text-foreground transition-colors">
							Privacy
						</Link>
						<Link href="#" className="hover:text-foreground transition-colors">
							Terms
						</Link>
						<Link href="#" className="hover:text-foreground transition-colors">
							Contact
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}

export default function LandingPage() {
	return (
		<Suspense fallback={<div className="min-h-screen" />}>
			<LandingPageContent />
		</Suspense>
	);
}
