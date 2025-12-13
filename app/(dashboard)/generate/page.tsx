"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GridBackground } from "@/components/ui/aceternity";
import { Sparkles, Building2, FolderOpen, ArrowRight } from "lucide-react";
import { companyDirectory } from "../companies/data";

export default function GeneratePage() {
	return (
		<div className="min-h-screen">
			<GridBackground />

			<div className="relative mx-auto max-w-4xl px-6 py-12 space-y-6">
				<Card className="border-border/50 bg-card/80 backdrop-blur">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-2xl">
							<Sparkles className="h-5 w-5 text-primary" />
							Resume & Cover Letter Generator
						</CardTitle>
						<CardDescription>
							Generation now lives inside each Company {"->"} Job so every
							draft, version, and download stays properly scoped.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<ol className="space-y-2 text-sm text-muted-foreground">
							<li>{"1)"} Pick or create a company folder.</li>
							<li>{"2)"} Add the job description and recruiter details.</li>
							<li>
								{"3)"} Choose a JSON Resume template, generate drafts, and save
								versions per job.
							</li>
						</ol>
						<div className="flex flex-wrap gap-2">
							<Button asChild>
								<Link href="/companies">
									<Building2 className="mr-2 h-4 w-4" />
									Open Companies
								</Link>
							</Button>
							<Button asChild variant="outline">
								<Link href="/companies/new">
									<FolderOpen className="mr-2 h-4 w-4" />
									New Company
								</Link>
							</Button>
							<Button asChild variant="outline">
								<Link href="/profile">Review Profile</Link>
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/50 bg-card/80 backdrop-blur">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-xl">
							<FolderOpen className="h-5 w-5 text-primary" />
							Quick jump to a company workspace
						</CardTitle>
						<CardDescription>
							Open a company to attach job descriptions, generate ATS drafts,
							and save versioned resumes/cover letters.
						</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-3 md:grid-cols-2">
						{companyDirectory.map((company) => (
							<Link
								key={company.id}
								href={`/companies/${company.slug}`}
								className="flex items-center justify-between rounded-lg border bg-background/60 p-4 transition hover:border-primary"
							>
								<div>
									<p className="font-semibold">{company.name}</p>
									<p className="text-sm text-muted-foreground">
										{company.jobs.length} job(s) |{" "}
										{company.jobs.reduce(
											(total, job) =>
												total +
												job.versions.filter((v) => v.type === "resume").length,
											0
										)}{" "}
										resume(s)
									</p>
								</div>
								<ArrowRight className="h-4 w-4 text-muted-foreground" />
							</Link>
						))}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
