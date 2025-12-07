"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GridBackground } from "@/components/ui/aceternity";
import {
	FileText,
	Plus,
	Clock,
	Bell,
	ChevronRight,
	Sparkles,
	Upload,
	Building2,
	User,
	CheckCircle2,
	AlertCircle,
	Calendar,
	TrendingUp,
	ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Data types
type Company = {
	id: string;
	name: string;
	status: string;
	resumes: number;
	coverLetters: number;
	lastActivity: string;
	appliedAt: string | null;
};

type RecentItem = {
	id: string;
	type: "resume" | "cover_letter";
	title: string;
	template: string;
	country: string;
	createdAt: string;
};

type FollowUp = {
	id: string;
	company: string;
	sentAt: string;
	nextReminder: string;
	status: string;
	reminderCount: number;
};

// Empty initial state - will be populated from Supabase
const stats = {
	totalResumes: 0,
	totalCoverLetters: 0,
	activeFollowUps: 0,
	pendingReminders: 0,
};

const companies: Company[] = [];
const recentItems: RecentItem[] = [];
const followUps: FollowUp[] = [];

const profileCompletion = {
	photo: false,
	skills: false,
	experience: false,
	education: false,
	preferences: false,
	percentage: 0,
};

const statusColors: Record<string, string> = {
	saved: "bg-secondary text-secondary-foreground",
	applied: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	interviewing: "bg-green-500/10 text-green-600 dark:text-green-400",
	offered: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
	rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
	withdrawn: "bg-muted text-muted-foreground",
};

export default function DashboardPage() {
	// User data will be populated from Supabase auth
	const user = { name: "there", avatarUrl: undefined };

	return (
		<div className="min-h-screen">
			<GridBackground />

			<div className="relative px-6 py-8">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-8"
				>
					<h1 className="text-3xl font-bold tracking-tight">
						Welcome back, {user.name}
					</h1>
					<p className="mt-1 text-muted-foreground">
						Track your applications, manage resumes, and stay on top of
						follow-ups.
					</p>
				</motion.div>

				{/* Quick Actions Bar */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-8"
				>
					<Card className="border-border/50 bg-card/80 backdrop-blur">
						<CardContent className="flex flex-wrap items-center gap-3 p-4">
							<Button asChild>
								<Link href="/generate">
									<Sparkles className="mr-2 h-4 w-4" />
									Generate Resume
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link href="/companies/new">
									<Plus className="mr-2 h-4 w-4" />
									New Company
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link href="/upload">
									<Upload className="mr-2 h-4 w-4" />
									Upload Resume
								</Link>
							</Button>
						</CardContent>
					</Card>
				</motion.div>

				<div className="grid gap-6 lg:grid-cols-3">
					{/* Main Content */}
					<div className="space-y-6 lg:col-span-2">
						{/* Stats Cards */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardContent className="p-4">
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<FileText className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="text-2xl font-bold">{stats.totalResumes}</p>
											<p className="text-xs text-muted-foreground">Resumes</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardContent className="p-4">
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<FileText className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="text-2xl font-bold">
												{stats.totalCoverLetters}
											</p>
											<p className="text-xs text-muted-foreground">
												Cover Letters
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardContent className="p-4">
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
											<Bell className="h-5 w-5 text-primary" />
										</div>
										<div>
											<p className="text-2xl font-bold">
												{stats.activeFollowUps}
											</p>
											<p className="text-xs text-muted-foreground">
												Active Follow-ups
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardContent className="p-4">
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
											<Clock className="h-5 w-5 text-orange-500" />
										</div>
										<div>
											<p className="text-2xl font-bold">
												{stats.pendingReminders}
											</p>
											<p className="text-xs text-muted-foreground">
												Pending Reminders
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</motion.div>

						{/* Company Folders */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader className="flex flex-row items-center justify-between">
									<div>
										<CardTitle className="flex items-center gap-2">
											<Building2 className="h-5 w-5" />
											Company Folders
										</CardTitle>
										<CardDescription>
											Organize resumes and cover letters by company
										</CardDescription>
									</div>
									<Button variant="outline" size="sm" asChild>
										<Link href="/companies">
											View all
											<ChevronRight className="ml-1 h-4 w-4" />
										</Link>
									</Button>
								</CardHeader>
								<CardContent>
									{companies.length > 0 ? (
										<div className="space-y-3">
											{companies.map((company) => (
												<Link
													key={company.id}
													href={`/companies/${company.id}`}
													className="flex items-center justify-between rounded-lg border bg-background/50 p-4 transition-colors hover:bg-muted/50"
												>
													<div className="flex items-center gap-4">
														<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-semibold">
															{company.name.charAt(0)}
														</div>
														<div>
															<p className="font-medium">{company.name}</p>
															<p className="text-sm text-muted-foreground">
																{company.resumes} resume(s) ·{" "}
																{company.coverLetters} cover letter(s)
															</p>
														</div>
													</div>
													<div className="flex items-center gap-3">
														<span
															className={cn(
																"rounded-full px-2 py-1 text-xs font-medium capitalize",
																statusColors[company.status]
															)}
														>
															{company.status}
														</span>
														<ChevronRight className="h-4 w-4 text-muted-foreground" />
													</div>
												</Link>
											))}
											<Button variant="outline" className="w-full" asChild>
												<Link href="/companies/new">
													<Plus className="mr-2 h-4 w-4" />
													Create New Folder
												</Link>
											</Button>
										</div>
									) : (
										<div className="flex flex-col items-center justify-center py-8 text-center">
											<Building2 className="mb-3 h-12 w-12 text-muted-foreground/50" />
											<p className="mb-1 font-medium">No company folders yet</p>
											<p className="mb-4 text-sm text-muted-foreground">
												Create folders to organize your applications
											</p>
											<Button asChild>
												<Link href="/companies/new">
													<Plus className="mr-2 h-4 w-4" />
													Create Your First Folder
												</Link>
											</Button>
										</div>
									)}
								</CardContent>
							</Card>
						</motion.div>

						{/* Recent Items */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.4 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader className="flex flex-row items-center justify-between">
									<div>
										<CardTitle className="flex items-center gap-2">
											<Clock className="h-5 w-5" />
											Recent Items
										</CardTitle>
										<CardDescription>
											Your recently created documents
										</CardDescription>
									</div>
									<Button variant="outline" size="sm" asChild>
										<Link href="/resumes">
											View all
											<ChevronRight className="ml-1 h-4 w-4" />
										</Link>
									</Button>
								</CardHeader>
								<CardContent>
									{recentItems.length > 0 ? (
										<div className="space-y-3">
											{recentItems.map((item) => (
												<Link
													key={item.id}
													href={`/${
														item.type === "resume" ? "resumes" : "cover-letters"
													}/${item.id}`}
													className="flex items-center justify-between rounded-lg border bg-background/50 p-4 transition-colors hover:bg-muted/50"
												>
													<div className="flex items-center gap-3">
														<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
															<FileText className="h-4 w-4 text-primary" />
														</div>
														<div>
															<p className="font-medium">{item.title}</p>
															<p className="text-sm text-muted-foreground">
																{item.template} · {item.country} ·{" "}
																{item.createdAt}
															</p>
														</div>
													</div>
													<div className="flex items-center gap-2">
														<span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium capitalize">
															{item.type.replace("_", " ")}
														</span>
														<ExternalLink className="h-4 w-4 text-muted-foreground" />
													</div>
												</Link>
											))}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center py-8 text-center">
											<FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
											<p className="mb-1 font-medium">No documents yet</p>
											<p className="mb-4 text-sm text-muted-foreground">
												Generate your first resume to get started
											</p>
											<Button asChild>
												<Link href="/generate">
													<Sparkles className="mr-2 h-4 w-4" />
													Generate Resume
												</Link>
											</Button>
										</div>
									)}
								</CardContent>
							</Card>
						</motion.div>
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Profile Completion */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<User className="h-5 w-5" />
										Profile Completion
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="mb-4">
										<div className="mb-2 flex items-center justify-between">
											<span className="text-sm font-medium">
												{profileCompletion.percentage}% Complete
											</span>
											<span className="text-sm text-muted-foreground">
												{profileCompletion.percentage === 100
													? "All done!"
													: "Keep going"}
											</span>
										</div>
										<div className="h-2 overflow-hidden rounded-full bg-secondary">
											<div
												className="h-full bg-primary transition-all"
												style={{ width: `${profileCompletion.percentage}%` }}
											/>
										</div>
									</div>
									<div className="space-y-2">
										{Object.entries(profileCompletion)
											.filter(([key]) => key !== "percentage")
											.map(([key, completed]) => (
												<div
													key={key}
													className="flex items-center justify-between text-sm"
												>
													<span className="capitalize">{key}</span>
													{completed ? (
														<CheckCircle2 className="h-4 w-4 text-green-500" />
													) : (
														<AlertCircle className="h-4 w-4 text-orange-500" />
													)}
												</div>
											))}
									</div>
									<Button className="mt-4 w-full" variant="outline" asChild>
										<Link href="/profile">Complete Profile</Link>
									</Button>
								</CardContent>
							</Card>
						</motion.div>

						{/* Upcoming Follow-ups */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<Bell className="h-5 w-5" />
										Upcoming Follow-ups
									</CardTitle>
									<CardDescription>
										Stay on top of your applications
									</CardDescription>
								</CardHeader>
								<CardContent>
									{followUps.length > 0 ? (
										<div className="space-y-3">
											{followUps.map((followUp) => (
												<div
													key={followUp.id}
													className="rounded-lg border bg-background/50 p-3"
												>
													<div className="flex items-center justify-between">
														<p className="font-medium">{followUp.company}</p>
														<span className="text-xs text-muted-foreground">
															Reminder #{followUp.reminderCount}
														</span>
													</div>
													<div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
														<Calendar className="h-3 w-3" />
														<span>Next: {followUp.nextReminder}</span>
													</div>
													<div className="mt-2 flex gap-2">
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
														>
															Snooze
														</Button>
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
														>
															Mark Complete
														</Button>
													</div>
												</div>
											))}
											<Button variant="outline" className="w-full" asChild>
												<Link href="/follow-ups">
													View All Follow-ups
													<ChevronRight className="ml-1 h-4 w-4" />
												</Link>
											</Button>
										</div>
									) : (
										<div className="flex flex-col items-center justify-center py-6 text-center">
											<Bell className="mb-2 h-10 w-10 text-muted-foreground/50" />
											<p className="mb-1 text-sm font-medium">
												No pending follow-ups
											</p>
											<p className="text-xs text-muted-foreground">
												Follow-ups will appear here after you apply
											</p>
										</div>
									)}
								</CardContent>
							</Card>
						</motion.div>

						{/* Quick Tips */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.4 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<TrendingUp className="h-5 w-5" />
										Quick Tips
									</CardTitle>
								</CardHeader>
								<CardContent>
									<ul className="space-y-2 text-sm text-muted-foreground">
										<li className="flex items-start gap-2">
											<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
											<span>
												Paste a job description to generate a tailored resume
												with keyword matching.
											</span>
										</li>
										<li className="flex items-start gap-2">
											<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
											<span>
												Use DE/EU templates when applying to German companies -
												they expect photos.
											</span>
										</li>
										<li className="flex items-start gap-2">
											<Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
											<span>
												Log your applications to get automatic follow-up
												reminders after 3 days.
											</span>
										</li>
									</ul>
								</CardContent>
							</Card>
						</motion.div>
					</div>
				</div>
			</div>
		</div>
	);
}
