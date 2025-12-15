"use client";

import { useEffect, useMemo, useState } from "react";
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
	Building2,
	User,
	CheckCircle2,
	AlertCircle,
	Calendar,
	TrendingUp,
	ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import type { Profile } from "@/lib/types/database";

// Data types
type Stats = {
	totalResumes: number;
	totalCoverLetters: number;
	activeFollowUps: number;
	pendingReminders: number;
};

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
	companyId: string;
	company: string;
	companyStatus: string;
	message: string;
	sentAt: string;
	nextReminder: string;
	status: string;
	reminderCount: number;
	interviewAt: string | null;
};

// Get reminder message based on company status
const getFollowUpMessage = (status: string): string => {
	switch (status) {
		case "saved":
			return "Time to submit your application!";
		case "applied":
			return "Follow up with the recruiter";
		case "interviewing":
			return "Prepare for your upcoming interview";
		case "offered":
			return "Don't forget to respond to the offer";
		default:
			return "Check on this application";
	}
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
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [stats, setStats] = useState<Stats>({
		totalResumes: 0,
		totalCoverLetters: 0,
		activeFollowUps: 0,
		pendingReminders: 0,
	});
	const [companies, setCompanies] = useState<Company[]>([]);
	const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
	const [followUps, setFollowUps] = useState<FollowUp[]>([]);
	const [loadingData, setLoadingData] = useState(true);

	useEffect(() => {
		const loadAllData = async () => {
			setLoadingProfile(true);
			setLoadingData(true);
			const supabase = getSupabaseBrowserClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				setLoadingProfile(false);
				setLoadingData(false);
				return;
			}

			// Load profile
			const { data: profileData } = await supabase
				.from("profiles")
				.select(
					"id, full_name, headline, avatar_url, skills, experience_summary, extended_profile, target_job_titles"
				)
				.eq("id", user.id)
				.single();

			setProfile(profileData as Profile | null);
			setLoadingProfile(false);

			// Load stats in parallel
			const [
				resumeCount,
				coverLetterCount,
				activeFollowUpsCount,
				pendingRemindersCount,
			] = await Promise.all([
				supabase
					.from("resumes")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id),
				supabase
					.from("cover_letters")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id),
				supabase
					.from("follow_ups")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id)
					.eq("status", "active"),
				supabase
					.from("follow_ups")
					.select("id", { count: "exact", head: true })
					.eq("user_id", user.id)
					.eq("status", "active")
					.lte("next_reminder_at", new Date().toISOString()),
			]);

			console.log("[Dashboard] Stats queries results:", {
				resumeCount: { count: resumeCount.count, error: resumeCount.error },
				coverLetterCount: {
					count: coverLetterCount.count,
					error: coverLetterCount.error,
				},
				activeFollowUpsCount: {
					count: activeFollowUpsCount.count,
					error: activeFollowUpsCount.error,
				},
				pendingRemindersCount: {
					count: pendingRemindersCount.count,
					error: pendingRemindersCount.error,
				},
				currentTime: new Date().toISOString(),
			});

			setStats({
				totalResumes: resumeCount.count || 0,
				totalCoverLetters: coverLetterCount.count || 0,
				activeFollowUps: activeFollowUpsCount.count || 0,
				pendingReminders: pendingRemindersCount.count || 0,
			});

			// Load companies with counts
			const { data: companiesData } = await supabase
				.from("companies")
				.select("id, name, status, applied_at, updated_at")
				.eq("user_id", user.id)
				.order("updated_at", { ascending: false })
				.limit(5);

			if (companiesData) {
				const companiesWithCounts = await Promise.all(
					companiesData.map(async (company) => {
						const [resumeRes, coverLetterRes] = await Promise.all([
							supabase
								.from("resumes")
								.select("id", { count: "exact", head: true })
								.eq("company_id", company.id),
							supabase
								.from("cover_letters")
								.select("id", { count: "exact", head: true })
								.eq("company_id", company.id),
						]);
						return {
							id: company.id,
							name: company.name,
							status: company.status || "saved",
							resumes: resumeRes.count || 0,
							coverLetters: coverLetterRes.count || 0,
							lastActivity: new Date(company.updated_at).toLocaleDateString(),
							appliedAt: company.applied_at
								? new Date(company.applied_at).toLocaleDateString()
								: null,
						};
					})
				);
				setCompanies(companiesWithCounts);
			}

			// Load recent items (resumes + cover letters)
			const [resumesRes, coverLettersRes] = await Promise.all([
				supabase
					.from("resumes")
					.select("id, title, template, country, created_at")
					.eq("user_id", user.id)
					.order("created_at", { ascending: false })
					.limit(5),
				supabase
					.from("cover_letters")
					.select("id, title, template, country, created_at")
					.eq("user_id", user.id)
					.order("created_at", { ascending: false })
					.limit(5),
			]);

			const allItems: RecentItem[] = [
				...(resumesRes.data || []).map((r) => ({
					id: r.id,
					type: "resume" as const,
					title: r.title,
					template: r.template || "default",
					country: r.country || "US",
					createdAt: new Date(r.created_at).toLocaleDateString(),
					_sortDate: new Date(r.created_at),
				})),
				...(coverLettersRes.data || []).map((c) => ({
					id: c.id,
					type: "cover_letter" as const,
					title: c.title,
					template: c.template || "professional",
					country: c.country || "US",
					createdAt: new Date(c.created_at).toLocaleDateString(),
					_sortDate: new Date(c.created_at),
				})),
			];
			allItems.sort(
				(a, b) =>
					(b as any)._sortDate.getTime() - (a as any)._sortDate.getTime()
			);
			setRecentItems(allItems.slice(0, 5).map((item) => item as RecentItem));

			// Load follow-ups with company names
			const { data: followUpsData, error: followUpsError } = await supabase
				.from("follow_ups")
				.select(
					"id, company_id, sent_at, next_reminder_at, status, reminder_count, message, companies(name, status, interview_at)"
				)
				.eq("user_id", user.id)
				.eq("status", "active")
				.order("next_reminder_at", { ascending: true })
				.limit(5);

			console.log("[Dashboard] Follow-ups query:", {
				userId: user.id,
				data: followUpsData,
				error: followUpsError,
				count: followUpsData?.length || 0,
			});

			// Also log all follow-ups without status filter to see what exists
			const { data: allFollowUps, error: allFollowUpsError } = await supabase
				.from("follow_ups")
				.select("id, company_id, status, next_reminder_at, sent_at")
				.eq("user_id", user.id);

			console.log("[Dashboard] ALL follow-ups (no status filter):", {
				data: allFollowUps,
				error: allFollowUpsError,
				count: allFollowUps?.length || 0,
			});

			if (followUpsData) {
				setFollowUps(
					followUpsData.map((f: any) => ({
						id: f.id,
						companyId: f.company_id,
						company: f.companies?.name || "Unknown Company",
						companyStatus: f.companies?.status || "saved",
						message:
							f.message || getFollowUpMessage(f.companies?.status || "saved"),
						sentAt: new Date(f.sent_at).toLocaleDateString(),
						nextReminder: f.next_reminder_at
							? new Date(f.next_reminder_at).toLocaleDateString()
							: "Not set",
						status: f.status,
						reminderCount: f.reminder_count || 0,
						interviewAt: f.companies?.interview_at || null,
					}))
				);
			}

			// setLoadingData(false); // removed useless assignment
		};

		void loadAllData();
	}, []);

	// Snooze follow-up (adds 3 days to next_reminder_at)
	const handleSnooze = async (followUpId: string) => {
		const supabase = getSupabaseBrowserClient();
		const newDate = new Date();
		newDate.setDate(newDate.getDate() + 3);

		const { error } = await supabase
			.from("follow_ups")
			.update({
				next_reminder_at: newDate.toISOString(),
				updated_at: new Date().toISOString(),
			})
			.eq("id", followUpId);

		if (!error) {
			setFollowUps((prev) =>
				prev.map((f) =>
					f.id === followUpId
						? { ...f, nextReminder: newDate.toLocaleDateString() }
						: f
				)
			);
			// Update pending reminders count
			setStats((prev) => ({
				...prev,
				pendingReminders: Math.max(0, prev.pendingReminders - 1),
			}));
		}
	};

	// Mark follow-up as completed
	const handleMarkComplete = async (followUpId: string) => {
		const supabase = getSupabaseBrowserClient();

		const { error } = await supabase
			.from("follow_ups")
			.update({
				status: "completed",
				response_received: true,
				updated_at: new Date().toISOString(),
			})
			.eq("id", followUpId);

		if (!error) {
			setFollowUps((prev) => prev.filter((f) => f.id !== followUpId));
			setStats((prev) => ({
				...prev,
				activeFollowUps: Math.max(0, prev.activeFollowUps - 1),
				pendingReminders: Math.max(0, prev.pendingReminders - 1),
			}));
		}
	};

	const profileCompletion = useMemo(() => {
		let extended: any = {};
		if (profile?.extended_profile) {
			if (typeof profile.extended_profile === "string") {
				try {
					extended = JSON.parse(profile.extended_profile);
				} catch {
					extended = {};
				}
			} else if (typeof profile.extended_profile === "object") {
				extended = profile.extended_profile;
			}
		}
		const photoUrl =
			profile?.avatar_url === null
				? null
				: extended.avatar_url || profile?.avatar_url || null;
		const photo = Boolean(photoUrl);
		const skills = (profile?.skills || []).length > 0;
		const experience =
			Boolean(profile?.experience_summary) ||
			(extended.work_experience || []).length > 0;
		const education = (extended.education || []).length > 0;

		const items: { label: string; completed: boolean }[] = [
			{ label: "Photo", completed: photo },
			{ label: "Skills", completed: skills },
			{ label: "Experience", completed: experience },
			{ label: "Education", completed: education },
		];

		if (
			Array.isArray(extended.custom_fields) &&
			extended.custom_fields.length
		) {
			items.push({
				label: "Custom fields",
				completed: true,
			});
		}

		if (Array.isArray(extended.customSections)) {
			extended.customSections.forEach((section: any) => {
				items.push({
					label: section.title || "Custom section",
					completed: Boolean(section.entries?.length),
				});
			});
		}

		const completedCount = items.filter((i) => i.completed).length;
		const percentage = items.length
			? Math.min(100, Math.round((completedCount / items.length) * 100))
			: 0;

		return { items, percentage };
	}, [profile]);

	const firstName =
		profile?.full_name?.split(" ")[0] ||
		profile?.full_name ||
		(loadingProfile ? "..." : "there");

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
						Welcome back, {firstName}
					</h1>
					<p className="mt-1 text-muted-foreground">
						Track your applications, manage resumes, and stay on top of
						follow-ups.
					</p>
				</motion.div>

				{/* Profile Completion Banner */}
				<ProfileCompletionBanner variant="banner" />

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
						{/* Profile Completion - only show when not 100% */}
						{profileCompletion.percentage < 100 && (
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
													Keep going
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
											{profileCompletion.items.map(({ label, completed }) => (
												<div
													key={label}
													className="flex items-center justify-between text-sm"
												>
													<span className="capitalize">{label}</span>
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
						)}

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
														<span
															className={cn(
																"text-xs px-2 py-0.5 rounded-full capitalize",
																statusColors[followUp.companyStatus] ||
																	statusColors.saved
															)}
														>
															{followUp.companyStatus}
														</span>
													</div>
													<p className="mt-1 text-sm text-primary font-medium">
														{followUp.message}
													</p>
													{followUp.interviewAt ? (
														<div className="mt-1 flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
															<Calendar className="h-3 w-3" />
															<span>
																Interview:{" "}
																{new Date(followUp.interviewAt).toLocaleString(
																	"en-US",
																	{
																		weekday: "short",
																		month: "short",
																		day: "numeric",
																		hour: "numeric",
																		minute: "2-digit",
																	}
																)}
															</span>
														</div>
													) : (
														<div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
															<Calendar className="h-3 w-3" />
															<span>Next: {followUp.nextReminder}</span>
														</div>
													)}
													<div className="mt-2 flex gap-2">
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
															onClick={() => handleSnooze(followUp.id)}
														>
															Snooze
														</Button>
														<Button
															size="sm"
															variant="outline"
															className="h-7 text-xs"
															onClick={() => handleMarkComplete(followUp.id)}
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
