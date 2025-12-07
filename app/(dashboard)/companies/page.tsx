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
import { Input } from "@/components/ui/input";
import { GridBackground } from "@/components/ui/aceternity";
import {
	Building2,
	Plus,
	Search,
	ChevronRight,
	Filter,
	MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

// Data types
type Company = {
	id: string;
	name: string;
	website: string | null;
	industry: string | null;
	status: string;
	resumes: number;
	coverLetters: number;
	lastActivity: string;
	appliedAt: string | null;
	createdAt: string;
};

// Empty initial state - will be populated from Supabase
const companies: Company[] = [];

const statusColors: Record<string, string> = {
	saved: "bg-secondary text-secondary-foreground",
	applied: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	interviewing: "bg-green-500/10 text-green-600 dark:text-green-400",
	offered: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
	rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
	withdrawn: "bg-muted text-muted-foreground",
};

const statusFilters = [
	{ value: "all", label: "All" },
	{ value: "saved", label: "Saved" },
	{ value: "applied", label: "Applied" },
	{ value: "interviewing", label: "Interviewing" },
	{ value: "offered", label: "Offered" },
	{ value: "rejected", label: "Rejected" },
];

export default function CompaniesPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");

	const filteredCompanies = companies.filter((company) => {
		const matchesSearch = company.name
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesStatus =
			statusFilter === "all" || company.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	return (
		<div className="min-h-screen">
			<GridBackground />

			<div className="relative px-6 py-8">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<div>
						<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
							<Building2 className="h-8 w-8 text-primary" />
							Companies
						</h1>
						<p className="mt-1 text-muted-foreground">
							Manage your company folders and track applications
						</p>
					</div>
					<Button asChild>
						<Link href="/companies/new">
							<Plus className="mr-2 h-4 w-4" />
							New Company
						</Link>
					</Button>
				</motion.div>

				{/* Filters */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-6"
				>
					<Card className="border-border/50 bg-card/80 backdrop-blur">
						<CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search companies..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
								/>
							</div>
							<div className="flex flex-wrap gap-2">
								{statusFilters.map((filter) => (
									<Button
										key={filter.value}
										variant={
											statusFilter === filter.value ? "default" : "outline"
										}
										size="sm"
										onClick={() => setStatusFilter(filter.value)}
									>
										{filter.label}
									</Button>
								))}
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Companies List */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					{filteredCompanies.length > 0 ? (
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{filteredCompanies.map((company) => (
								<Link key={company.id} href={`/companies/${company.id}`}>
									<Card className="border-border/50 bg-card/80 backdrop-blur transition-colors hover:bg-accent/50">
										<CardContent className="p-6">
											<div className="flex items-start justify-between">
												<div className="flex items-center gap-4">
													<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg font-semibold">
														{company.name.charAt(0)}
													</div>
													<div>
														<h3 className="font-semibold">{company.name}</h3>
														{company.industry && (
															<p className="text-sm text-muted-foreground">
																{company.industry}
															</p>
														)}
													</div>
												</div>
												<span
													className={cn(
														"rounded-full px-2 py-1 text-xs font-medium capitalize",
														statusColors[company.status]
													)}
												>
													{company.status}
												</span>
											</div>
											<div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
												<span>
													{company.resumes} resume(s) · {company.coverLetters}{" "}
													cover letter(s)
												</span>
												<ChevronRight className="h-4 w-4" />
											</div>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					) : (
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardContent className="flex flex-col items-center justify-center py-16 text-center">
								<Building2 className="mb-4 h-16 w-16 text-muted-foreground/50" />
								<h3 className="mb-2 text-lg font-semibold">
									{searchQuery || statusFilter !== "all"
										? "No companies found"
										: "No company folders yet"}
								</h3>
								<p className="mb-6 max-w-sm text-muted-foreground">
									{searchQuery || statusFilter !== "all"
										? "Try adjusting your search or filters"
										: "Create company folders to organize your job applications, resumes, and cover letters."}
								</p>
								{!searchQuery && statusFilter === "all" && (
									<Button asChild>
										<Link href="/companies/new">
											<Plus className="mr-2 h-4 w-4" />
											Create Your First Company
										</Link>
									</Button>
								)}
							</CardContent>
						</Card>
					)}
				</motion.div>
			</div>
		</div>
	);
}
