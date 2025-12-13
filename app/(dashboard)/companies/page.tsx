"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GridBackground } from "@/components/ui/aceternity";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Building2,
	Plus,
	Search,
	ChevronRight,
	Trash2,
	Loader2,
	Calendar,
	FileText,
	Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Data types
type Company = {
	id: string;
	name: string;
	website: string | null;
	industry: string | null;
	status: string;
	job_title: string | null;
	job_url: string | null;
	salary_range: string | null;
	applied_at: string | null;
	follow_up_date: string | null;
	notes: string | null;
	resumeCount: number;
	coverLetterCount: number;
	created_at: string;
	updated_at: string;
};

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
	const [companies, setCompanies] = useState<Company[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");

	// Delete modal state
	const [deleteModal, setDeleteModal] = useState<{
		open: boolean;
		company: Company | null;
	}>({
		open: false,
		company: null,
	});
	const [isDeleting, setIsDeleting] = useState(false);

	// Fetch companies from API
	useEffect(() => {
		async function fetchCompanies() {
			try {
				setIsLoading(true);
				const response = await fetch("/api/companies");
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to fetch companies");
				}

				setCompanies(data.companies || []);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Something went wrong");
			} finally {
				setIsLoading(false);
			}
		}

		fetchCompanies();
	}, []);

	const filteredCompanies = companies.filter((company) => {
		const matchesSearch =
			company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(company.job_title?.toLowerCase().includes(searchQuery.toLowerCase()) ??
				false);
		const matchesStatus =
			statusFilter === "all" || company.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	const handleDeleteClick = (e: React.MouseEvent, company: Company) => {
		e.preventDefault();
		e.stopPropagation();
		setDeleteModal({ open: true, company });
	};

	const handleDeleteConfirm = async () => {
		if (!deleteModal.company) return;

		setIsDeleting(true);
		try {
			const response = await fetch(`/api/companies/${deleteModal.company.id}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to delete company");
			}

			// Remove from local state
			setCompanies((prev) =>
				prev.filter((c) => c.id !== deleteModal.company!.id)
			);
			setDeleteModal({ open: false, company: null });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete");
		} finally {
			setIsDeleting(false);
		}
	};

	const formatDate = (dateString: string | null) => {
		if (!dateString) return null;
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

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
							Applications
						</h1>
						<p className="mt-1 text-muted-foreground">
							Track your job applications and saved materials
						</p>
					</div>
					<Button asChild>
						<Link href="/generate">
							<Plus className="mr-2 h-4 w-4" />
							New Application
						</Link>
					</Button>
				</motion.div>

				{/* Error display */}
				{error && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
					>
						{error}
						<Button
							variant="link"
							className="ml-2 h-auto p-0 text-destructive"
							onClick={() => setError(null)}
						>
							Dismiss
						</Button>
					</motion.div>
				)}

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
									placeholder="Search by company or job title..."
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

				{/* Loading state */}
				{isLoading && (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				)}

				{/* Companies List */}
				{!isLoading && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
					>
						{filteredCompanies.length > 0 ? (
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{filteredCompanies.map((company) => (
									<Link key={company.id} href={`/companies/${company.id}`}>
										<Card className="group relative border-border/50 bg-card/80 backdrop-blur transition-colors hover:bg-accent/50">
											{/* Delete button */}
											<button
												onClick={(e) => handleDeleteClick(e, company)}
												className="absolute right-2 top-2 z-10 rounded-md p-1.5 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
												title="Delete application"
											>
												<Trash2 className="h-4 w-4 text-destructive" />
											</button>

											<CardContent className="p-6">
												<div className="flex items-start justify-between">
													<div className="flex items-center gap-4">
														<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg font-semibold">
															{company.name.charAt(0)}
														</div>
														<div>
															<h3 className="font-semibold">{company.name}</h3>
															{company.job_title && (
																<p className="text-sm text-muted-foreground">
																	{company.job_title}
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

												{/* Additional info */}
												<div className="mt-4 space-y-1 text-sm text-muted-foreground">
													{company.applied_at && (
														<div className="flex items-center gap-2">
															<Calendar className="h-3.5 w-3.5" />
															Applied {formatDate(company.applied_at)}
														</div>
													)}
													{company.salary_range && (
														<div className="flex items-center gap-2">
															<span className="text-xs">💰</span>
															{company.salary_range}
														</div>
													)}
												</div>

												<div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
													<div className="flex items-center gap-3">
														{company.resumeCount > 0 && (
															<span className="flex items-center gap-1">
																<FileText className="h-3.5 w-3.5" />
																{company.resumeCount}
															</span>
														)}
														{company.coverLetterCount > 0 && (
															<span className="flex items-center gap-1">
																<Mail className="h-3.5 w-3.5" />
																{company.coverLetterCount}
															</span>
														)}
													</div>
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
											? "No applications found"
											: "No applications yet"}
									</h3>
									<p className="mb-6 max-w-sm text-muted-foreground">
										{searchQuery || statusFilter !== "all"
											? "Try adjusting your search or filters"
											: "Generate a resume and save it to start tracking your applications."}
									</p>
									{!searchQuery && statusFilter === "all" && (
										<Button asChild>
											<Link href="/generate">
												<Plus className="mr-2 h-4 w-4" />
												Create Your First Resume
											</Link>
										</Button>
									)}
								</CardContent>
							</Card>
						)}
					</motion.div>
				)}
			</div>

			{/* Delete Confirmation Modal */}
			<Dialog
				open={deleteModal.open}
				onOpenChange={(open) =>
					setDeleteModal({ open, company: open ? deleteModal.company : null })
				}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<Trash2 className="h-5 w-5" />
							Delete Application
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete the application for{" "}
							<strong>{deleteModal.company?.job_title}</strong> at{" "}
							<strong>{deleteModal.company?.name}</strong>? This will also
							delete all associated resumes and cover letters. This action
							cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteModal({ open: false, company: null })}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteConfirm}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								<>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
