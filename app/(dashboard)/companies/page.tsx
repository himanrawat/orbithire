"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, tabClass, tabListClass } from "@/components/app/blocks";
import { statusClass } from "@/components/app/status";
import { FailedPdfsPanel } from "@/components/documents/FailedPdfsPanel";

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

		void fetchCompanies();
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

			<div className="relative mx-auto max-w-6xl px-4 py-8 md:px-8">
				<PageHeader
					icon={<Building2 />}
					title="Applications"
					description="Track your job applications and the documents you made for each."
					actions={
						<Button variant="cap" asChild>
							<Link href="/generate">
								<Plus className="h-4 w-4" />
								New application
							</Link>
						</Button>
					}
				/>

				<FailedPdfsPanel className="mb-6" />

				{/* Error display */}
				{error && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						className="mb-6 rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]"
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
					<Card>
						<CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search by company or job title"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
								/>
							</div>
							<div role="tablist" aria-label="Filter by status" className={tabListClass}>
								{statusFilters.map((filter) => (
									<button
										key={filter.value}
										role="tab"
										aria-selected={statusFilter === filter.value}
										className={tabClass(statusFilter === filter.value)}
										onClick={() => setStatusFilter(filter.value)}
									>
										{filter.label}
									</button>
								))}
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Loading state */}
				{isLoading && (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
										<Card className="group relative h-full transition-[border-color,box-shadow] duration-[var(--duration-base)] hover:border-input hover:shadow-[var(--shadow-lift)]">
											{/* Delete button */}
											<button
												onClick={(e) => handleDeleteClick(e, company)}
												className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-[var(--radius-sm)] opacity-0 transition-opacity hover:bg-[var(--danger-soft)] focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
												aria-label={`Delete ${company.name}`}
												title="Delete application"
											>
												<Trash2 className="h-4 w-4 text-destructive" />
											</button>

											<CardContent className="p-6">
												<div className="flex items-start justify-between">
													<div className="flex items-center gap-4">
														<div className="flex h-12 w-12 flex-none items-center justify-center rounded-[var(--radius-control)] bg-secondary font-display text-lg font-[650]">
															{company.name.charAt(0)}
														</div>
														<div>
															<h3 className="font-display font-[650] tracking-[-0.01em]">{company.name}</h3>
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
															statusClass(company.status)
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
							<Card>
								<EmptyState
									title={searchQuery || statusFilter !== "all" ? "No applications found" : "No applications yet"}
									description={
										searchQuery || statusFilter !== "all"
											? "Try a different search or status."
											: "Generate a resume and save it to start tracking your applications."
									}
									action={
										!searchQuery && statusFilter === "all" ? (
											<Button variant="default" asChild>
												<Link href="/generate">
													<Plus className="h-4 w-4" />
													Create your first resume
												</Link>
											</Button>
										) : undefined
									}
								/>
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
