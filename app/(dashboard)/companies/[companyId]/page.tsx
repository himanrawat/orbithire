"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { PdfStatusBadge, type PdfStatusInfo } from "@/components/PdfStatusBadge";
import type { PdfStatus } from "@/lib/types/database";
import {
	Building2,
	ChevronLeft,
	FileText,
	Mail,
	Loader2,
	Calendar,
	DollarSign,
	Trash2,
	ExternalLink,
	Download,
	Clock,
	Edit3,
	Check,
	X,
	Eye,
	ArrowRight,
	CalendarIcon,
	Plus,
} from "lucide-react";

// Simple date formatting helper
const formatDateTime = (date: Date): string => {
	return date.toLocaleString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
};

// Types based on Supabase schema
type Resume = {
	id: string;
	title: string;
	content_json: any;
	content_text: string | null;
	job_description: string | null;
	template: string;
	pdf_url: string | null;
	docx_url: string | null;
	engine?: "html" | "typst";
	source?: "portal" | "mcp" | "import";
	pdf_status?: PdfStatus;
	pdf_error?: string | null;
	created_at: string;
	updated_at: string;
};

type CoverLetter = {
	id: string;
	title: string;
	content: string;
	engine?: "html" | "typst";
	pdf_status?: PdfStatus;
	pdf_error?: string | null;
	job_description: string | null;
	template: string;
	pdf_url: string | null;
	docx_url: string | null;
	created_at: string;
	updated_at: string;
};

type StatusHistoryEntry = {
	from: string;
	to: string;
	changed_at: string;
};

type Company = {
	id: string;
	name: string;
	website: string | null;
	industry: string | null;
	status: string;
	notes: string | null;
	job_title: string | null;
	job_description: string | null;
	job_url: string | null;
	recruiter_name: string | null;
	salary_range: string | null;
	applied_at: string | null;
	follow_up_date: string | null;
	interview_at: string | null;
	interview_rounds?: { date: string; notes: string }[];
	status_history?: StatusHistoryEntry[];
	created_at: string;
	updated_at: string;
	resumes: Resume[];
	cover_letters: CoverLetter[];
};

type ApplicationStatus =
	| "saved"
	| "applied"
	| "interviewing"
	| "offered"
	| "rejected"
	| "withdrawn";

const statusOptions: {
	value: ApplicationStatus;
	label: string;
	color: string;
}[] = [
	{
		value: "saved",
		label: "Saved",
		color: "bg-secondary text-secondary-foreground",
	},
	{
		value: "applied",
		label: "Applied",
		color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	},
	{
		value: "interviewing",
		label: "Interviewing",
		color: "bg-green-500/10 text-green-600 dark:text-green-400",
	},
	{
		value: "offered",
		label: "Offered",
		color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
	},
	{
		value: "rejected",
		label: "Rejected",
		color: "bg-red-500/10 text-red-600 dark:text-red-400",
	},
	{
		value: "withdrawn",
		label: "Withdrawn",
		color: "bg-muted text-muted-foreground",
	},
];

export default function CompanyDetailPage({
	params,
}: Readonly<{
	params: { companyId: string };
}>) {
	const router = useRouter();
	const companyId = params.companyId;

	// Data state
	const [company, setCompany] = useState<Company | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Edit state
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [editForm, setEditForm] = useState({
		name: "",
		status: "applied" as ApplicationStatus,
		jobTitle: "",
		jobDescription: "",
		jobUrl: "",
		recruiterName: "",
		salaryRange: "",
		notes: "",
		appliedAt: "",
		followUpDate: "",
		interviewRounds: [] as { date: string; notes: string }[],
	});

	// Delete modal
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	// PDF viewer modal
	const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
	const [pdfViewerTitle, setPdfViewerTitle] = useState<string>("");

	// Interview round modal
	const [showInterviewModal, setShowInterviewModal] = useState(false);
	const [editingInterviewIndex, setEditingInterviewIndex] = useState<
		number | null
	>(null);
	const [interviewModalDate, setInterviewModalDate] = useState<
		Date | undefined
	>(undefined);
	const [interviewModalHour, setInterviewModalHour] = useState("09");
	const [interviewModalMinute, setInterviewModalMinute] = useState("00");
	const [interviewModalPeriod, setInterviewModalPeriod] = useState<"AM" | "PM">(
		"AM"
	);
	const [interviewModalNotes, setInterviewModalNotes] = useState("");

	// Helper to open interview modal for new or edit
	const openInterviewModal = (index: number | null = null) => {
		if (index !== null && editForm.interviewRounds[index]) {
			// Editing existing
			const round = editForm.interviewRounds[index];
			if (round.date) {
				const dateObj = new Date(round.date);
				if (!isNaN(dateObj.getTime())) {
					setInterviewModalDate(dateObj);
					let hours = dateObj.getHours();
					const minutes = dateObj.getMinutes();
					const period = hours >= 12 ? "PM" : "AM";
					if (hours > 12) hours -= 12;
					if (hours === 0) hours = 12;
					setInterviewModalHour(hours.toString().padStart(2, "0"));
					setInterviewModalMinute(minutes.toString().padStart(2, "0"));
					setInterviewModalPeriod(period);
				} else {
					setInterviewModalDate(undefined);
					setInterviewModalHour("09");
					setInterviewModalMinute("00");
					setInterviewModalPeriod("AM");
				}
			} else {
				setInterviewModalDate(undefined);
				setInterviewModalHour("09");
				setInterviewModalMinute("00");
				setInterviewModalPeriod("AM");
			}
			setInterviewModalNotes(round.notes || "");
		} else {
			// New interview
			setInterviewModalDate(undefined);
			setInterviewModalHour("09");
			setInterviewModalMinute("00");
			setInterviewModalPeriod("AM");
			setInterviewModalNotes("");
		}
		setEditingInterviewIndex(index);
		setShowInterviewModal(true);
	};

	// Save interview from modal
	const saveInterviewFromModal = () => {
		if (!interviewModalDate) return;

		let hours = Number.parseInt(interviewModalHour, 10);
		const minutes = Number.parseInt(interviewModalMinute, 10);
		if (interviewModalPeriod === "PM" && hours !== 12) hours += 12;
		if (interviewModalPeriod === "AM" && hours === 12) hours = 0;

		const fullDate = new Date(interviewModalDate);
		fullDate.setHours(hours, minutes, 0, 0);

		const dateStr = fullDate.toISOString().slice(0, 16); // datetime-local format

		const newRound = { date: dateStr, notes: interviewModalNotes };

		if (editingInterviewIndex === null) {
			// Add new
			setEditForm({
				...editForm,
				interviewRounds: [...editForm.interviewRounds, newRound],
			});
		} else {
			// Update existing
			const newRounds = [...editForm.interviewRounds];
			newRounds[editingInterviewIndex] = newRound;
			setEditForm({ ...editForm, interviewRounds: newRounds });
		}

		setShowInterviewModal(false);
	};

	// Auto-open interview modal when switching to interviewing status
	useEffect(() => {
		if (isEditing) {
			if (
				editForm.status === "interviewing" &&
				editForm.interviewRounds.length === 0
			) {
				// Open the modal to add the first interview round
				openInterviewModal(null);
			} else if (
				editForm.status !== "interviewing" &&
				editForm.interviewRounds.length > 0
			) {
				// Clear interview rounds when switching away from interviewing
				setEditForm((prev) => ({
					...prev,
					interviewRounds: [],
				}));
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isEditing, editForm.status]);

	// Fetch company data
	useEffect(() => {
		async function fetchCompany() {
			try {
				setIsLoading(true);
				const response = await fetch(`/api/companies/${companyId}`);
				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || "Failed to fetch company");
				}

				setCompany(data.company);
				// Initialize edit form with fetched data
				setEditForm({
					name: data.company.name || "",
					status: data.company.status || "applied",
					jobTitle: data.company.job_title || "",
					jobDescription: data.company.job_description || "",
					jobUrl: data.company.job_url || "",
					recruiterName: data.company.recruiter_name || "",
					salaryRange: data.company.salary_range || "",
					notes: data.company.notes || "",
					appliedAt: data.company.applied_at?.split("T")[0] || "",
					followUpDate: data.company.follow_up_date?.split("T")[0] || "",
					interviewRounds: data.company.interview_rounds || [],
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : "Something went wrong");
			} finally {
				setIsLoading(false);
			}
		}

		fetchCompany();
	}, [companyId]);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			const response = await fetch(`/api/companies/${companyId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: editForm.name,
					status: editForm.status,
					jobTitle: editForm.jobTitle,
					jobDescription: editForm.jobDescription,
					jobUrl: editForm.jobUrl,
					recruiterName: editForm.recruiterName,
					salaryRange: editForm.salaryRange,
					notes: editForm.notes,
					appliedAt: editForm.appliedAt || null,
					followUpDate: editForm.followUpDate || null,
					interviewRounds: editForm.interviewRounds,
				}),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to update");
			}

			// Update local state
			setCompany((prev) =>
				prev
					? {
							...prev,
							name: editForm.name,
							status: editForm.status,
							job_title: editForm.jobTitle,
							job_description: editForm.jobDescription,
							job_url: editForm.jobUrl,
							recruiter_name: editForm.recruiterName,
							salary_range: editForm.salaryRange,
							notes: editForm.notes,
							applied_at: editForm.appliedAt || null,
							follow_up_date: editForm.followUpDate || null,
							interview_rounds: editForm.interviewRounds,
					  }
					: null
			);
			setIsEditing(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const response = await fetch(`/api/companies/${companyId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to delete");
			}

			router.push("/companies");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete");
			setIsDeleting(false);
		}
	};

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "-";
		return new Date(dateString).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	/** No PDF yet: explain why (rendering, failed, or nothing to render). */
	const explainMissingPdf = (resume: Resume) => {
		setError(
			resume.pdf_status === "failed"
				? `PDF render failed: ${resume.pdf_error ?? "unknown error"}. Use Retry.`
				: resume.engine === "typst"
					? "The PDF is still being rendered – it will appear here in a few seconds."
					: "This resume has no PDF. Open it in the editor and save to render one."
		);
	};

	const handleViewResume = (resume: Resume) => {
		if (!resume.pdf_url) return explainMissingPdf(resume);
		setPdfViewerUrl(resume.pdf_url);
		setPdfViewerTitle(resume.title);
	};

	const handleDownloadResume = (resume: Resume) => {
		if (!resume.pdf_url) return explainMissingPdf(resume);
		window.open(resume.pdf_url, "_blank");
	};

	const applyPdfStatus = (
		kind: "resumes" | "cover_letters",
		id: string,
		st: PdfStatusInfo
	) => {
		setCompany((prev) => {
			if (!prev) return prev;
			if (kind === "resumes") {
				return {
					...prev,
					resumes: prev.resumes.map((d) =>
						d.id === id ? { ...d, pdf_status: st.pdf_status, pdf_error: st.pdf_error, pdf_url: st.pdf_url } : d
					),
				};
			}
			return {
				...prev,
				cover_letters: prev.cover_letters.map((d) =>
					d.id === id ? { ...d, pdf_status: st.pdf_status, pdf_error: st.pdf_error, pdf_url: st.pdf_url } : d
				),
			};
		});
	};

	const getStatusColor = (status: string) => {
		return (
			statusOptions.find((s) => s.value === status)?.color || "bg-secondary"
		);
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	// Error state
	if (error || !company) {
		return (
			<div className="min-h-screen">
				<GridBackground />
				<div className="relative px-6 py-8">
					<Button variant="ghost" asChild className="mb-4">
						<Link href="/companies">
							<ChevronLeft className="mr-2 h-4 w-4" />
							Back to Applications
						</Link>
					</Button>
					<Card className="border-destructive/50 bg-destructive/10">
						<CardContent className="flex flex-col items-center justify-center py-16 text-center">
							<h3 className="mb-2 text-lg font-semibold text-destructive">
								{error || "Company not found"}
							</h3>
							<Button onClick={() => router.push("/companies")}>
								Go to Applications
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<GridBackground />

			<div className="relative px-6 py-8">
				{/* Back button */}
				<Button variant="ghost" asChild className="mb-4">
					<Link href="/companies">
						<ChevronLeft className="mr-2 h-4 w-4" />
						Back to Applications
					</Link>
				</Button>

				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
				>
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-2xl font-bold">
								{company.name.charAt(0)}
							</div>
							<div>
								<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
									{company.name}
								</h1>
								{company.job_title && (
									<p className="text-lg text-muted-foreground">
										{company.job_title}
									</p>
								)}
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<span
								className={cn(
									"rounded-full px-3 py-1 text-sm font-medium capitalize",
									getStatusColor(company.status)
								)}
							>
								{company.status}
							</span>
							{company.applied_at && (
								<span className="flex items-center gap-1 text-sm text-muted-foreground">
									<Calendar className="h-4 w-4" />
									Applied {formatDate(company.applied_at)}
								</span>
							)}
							{company.salary_range && (
								<span className="flex items-center gap-1 text-sm text-muted-foreground">
									<DollarSign className="h-4 w-4" />
									{company.salary_range}
								</span>
							)}
						</div>
					</div>

					<div className="flex flex-wrap gap-2">
						{isEditing ? (
							<>
								<Button
									variant="outline"
									onClick={() => setIsEditing(false)}
									disabled={isSaving}
								>
									<X className="mr-2 h-4 w-4" />
									Cancel
								</Button>
								<Button onClick={handleSave} disabled={isSaving}>
									{isSaving ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Check className="mr-2 h-4 w-4" />
									)}
									Save Changes
								</Button>
							</>
						) : (
							<>
								<Button variant="outline" onClick={() => setIsEditing(true)}>
									<Edit3 className="mr-2 h-4 w-4" />
									Edit
								</Button>
								<Button
									variant="destructive"
									onClick={() => setShowDeleteModal(true)}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</Button>
							</>
						)}
					</div>
				</motion.div>

				<div className="grid gap-6 lg:grid-cols-3">
					{/* Main content */}
					<div className="space-y-6 lg:col-span-2">
						{/* Application Details */}
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Building2 className="h-5 w-5" />
									Application Details
								</CardTitle>
								<CardDescription>
									Job information and tracking details
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{isEditing ? (
									<>
										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label>Company Name</Label>
												<Input
													value={editForm.name}
													onChange={(e) =>
														setEditForm({ ...editForm, name: e.target.value })
													}
												/>
											</div>
											<div className="space-y-2">
												<Label>Status</Label>
												<Select
													value={editForm.status}
													onValueChange={(value: ApplicationStatus) =>
														setEditForm({ ...editForm, status: value })
													}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{statusOptions.map((status) => (
															<SelectItem
																key={status.value}
																value={status.value}
															>
																{status.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label>Job Title</Label>
												<Input
													value={editForm.jobTitle}
													onChange={(e) =>
														setEditForm({
															...editForm,
															jobTitle: e.target.value,
														})
													}
													placeholder="e.g., Senior Software Engineer"
												/>
											</div>
											<div className="space-y-2">
												<Label>Job URL</Label>
												<Input
													value={editForm.jobUrl}
													onChange={(e) =>
														setEditForm({ ...editForm, jobUrl: e.target.value })
													}
													placeholder="https://..."
												/>
											</div>
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label>Salary Range</Label>
												<Input
													value={editForm.salaryRange}
													onChange={(e) =>
														setEditForm({
															...editForm,
															salaryRange: e.target.value,
														})
													}
													placeholder="$100k - $150k"
												/>
											</div>
											<div className="space-y-2">
												<Label>Recruiter Name</Label>
												<Input
													value={editForm.recruiterName}
													onChange={(e) =>
														setEditForm({
															...editForm,
															recruiterName: e.target.value,
														})
													}
													placeholder="Contact person"
												/>
											</div>
										</div>

										<div className="grid gap-4 md:grid-cols-2">
											<div className="space-y-2">
												<Label>Applied Date</Label>
												<Input
													type="date"
													value={editForm.appliedAt}
													onChange={(e) =>
														setEditForm({
															...editForm,
															appliedAt: e.target.value,
														})
													}
												/>
											</div>
											<div className="space-y-2">
												<Label>Follow-up Date</Label>
												<Input
													type="date"
													value={editForm.followUpDate}
													onChange={(e) =>
														setEditForm({
															...editForm,
															followUpDate: e.target.value,
														})
													}
												/>
											</div>
										</div>

										{editForm.status === "interviewing" && (
											<div className="space-y-3">
												<Label>Interview Rounds</Label>
												{editForm.interviewRounds.length > 0 ? (
													<div className="space-y-2">
														{editForm.interviewRounds.map((round, idx) => (
															<div
																key={`interview-round-${round.date || idx}`}
																className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30"
															>
																<CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
																<div className="flex-1 min-w-0">
																	<p className="text-sm font-medium">
																		{round.date
																			? formatDateTime(new Date(round.date))
																			: "No date set"}
																	</p>
																	{round.notes && (
																		<p className="text-xs text-muted-foreground truncate">
																			{round.notes}
																		</p>
																	)}
																</div>
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	className="h-8 w-8"
																	onClick={() => openInterviewModal(idx)}
																>
																	<Edit3 className="h-4 w-4" />
																</Button>
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	className="h-8 w-8 text-destructive hover:text-destructive"
																	onClick={() => {
																		const newRounds =
																			editForm.interviewRounds.filter(
																				(_, i) => i !== idx
																			);
																		setEditForm({
																			...editForm,
																			interviewRounds: newRounds,
																		});
																	}}
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</div>
														))}
													</div>
												) : (
													<p className="text-sm text-muted-foreground">
														No interview rounds scheduled yet.
													</p>
												)}
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => openInterviewModal(null)}
												>
													<Plus className="h-4 w-4 mr-2" />
													Add Interview Round
												</Button>
												<p className="text-xs text-muted-foreground">
													Add one or more interview rounds. A reminder will be
													created 1 day before each round.
												</p>
											</div>
										)}

										<div className="space-y-2">
											<Label>Job Description</Label>
											<Textarea
												value={editForm.jobDescription}
												onChange={(e) =>
													setEditForm({
														...editForm,
														jobDescription: e.target.value,
													})
												}
												rows={6}
												placeholder="Paste the job description here..."
											/>
										</div>

										<div className="space-y-2">
											<Label>Notes</Label>
											<Textarea
												value={editForm.notes}
												onChange={(e) =>
													setEditForm({ ...editForm, notes: e.target.value })
												}
												rows={3}
												placeholder="Interview notes, contacts, timeline..."
											/>
										</div>
									</>
								) : (
									<>
										<div className="grid gap-4 md:grid-cols-2">
											<div>
												<p className="text-sm text-muted-foreground">Company</p>
												<p className="font-medium">{company.name}</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">Status</p>
												<span
													className={cn(
														"inline-block rounded-full px-2 py-0.5 text-sm font-medium capitalize",
														getStatusColor(company.status)
													)}
												>
													{company.status}
												</span>
											</div>
										</div>

										{(company.job_title || company.job_url) && (
											<div className="grid gap-4 md:grid-cols-2">
												{company.job_title && (
													<div>
														<p className="text-sm text-muted-foreground">
															Job Title
														</p>
														<p className="font-medium">{company.job_title}</p>
													</div>
												)}
												{company.job_url && (
													<div>
														<p className="text-sm text-muted-foreground">
															Job URL
														</p>
														<a
															href={company.job_url}
															target="_blank"
															rel="noopener noreferrer"
															className="flex items-center gap-1 font-medium text-primary hover:underline"
														>
															View Posting
															<ExternalLink className="h-3 w-3" />
														</a>
													</div>
												)}
											</div>
										)}

										{(company.salary_range || company.recruiter_name) && (
											<div className="grid gap-4 md:grid-cols-2">
												{company.salary_range && (
													<div>
														<p className="text-sm text-muted-foreground">
															Salary Range
														</p>
														<p className="font-medium">
															{company.salary_range}
														</p>
													</div>
												)}
												{company.recruiter_name && (
													<div>
														<p className="text-sm text-muted-foreground">
															Recruiter
														</p>
														<p className="font-medium">
															{company.recruiter_name}
														</p>
													</div>
												)}
											</div>
										)}

										{(company.applied_at || company.follow_up_date) && (
											<div className="grid gap-4 md:grid-cols-2">
												{company.applied_at && (
													<div>
														<p className="text-sm text-muted-foreground">
															Applied Date
														</p>
														<p className="font-medium">
															{formatDate(company.applied_at)}
														</p>
													</div>
												)}
												{company.follow_up_date && (
													<div>
														<p className="text-sm text-muted-foreground">
															Follow-up Date
														</p>
														<p className="flex items-center gap-1 font-medium">
															<Clock className="h-4 w-4 text-primary" />
															{formatDate(company.follow_up_date)}
														</p>
													</div>
												)}
											</div>
										)}

										{company.status === "interviewing" &&
											company.interview_rounds &&
											company.interview_rounds.length > 0 &&
											(() => {
												// Only show the next upcoming interview round
												const now = new Date();
												const sorted = [...company.interview_rounds]
													.filter((r) => r.date)
													.sort(
														(a, b) =>
															new Date(a.date).getTime() -
															new Date(b.date).getTime()
													);
												const nextRound =
													sorted.find((r) => new Date(r.date) > now) ||
													sorted[0];
												if (!nextRound) return null;
												return (
													<div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
														<p className="text-sm text-muted-foreground mb-2">
															Next Interview Scheduled
														</p>
														<div className="flex items-center gap-2">
															<Calendar className="h-4 w-4" />
															<span className="font-medium text-green-600 dark:text-green-400">
																{nextRound.date
																	? new Date(nextRound.date).toLocaleString(
																			"en-US",
																			{
																				weekday: "long",
																				month: "long",
																				day: "numeric",
																				year: "numeric",
																				hour: "numeric",
																				minute: "2-digit",
																			}
																	  )
																	: "No date set"}
															</span>
															{nextRound.notes && (
																<span className="text-xs text-muted-foreground">
																	({nextRound.notes})
																</span>
															)}
														</div>
													</div>
												);
											})()}

										{company.job_description && (
											<div>
												<p className="mb-2 text-sm text-muted-foreground">
													Job Description
												</p>
												<div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/50 p-3 text-sm">
													<pre className="whitespace-pre-wrap font-sans">
														{company.job_description}
													</pre>
												</div>
											</div>
										)}

										{company.notes && (
											<div>
												<p className="mb-2 text-sm text-muted-foreground">
													Notes
												</p>
												<div className="rounded-lg border bg-muted/50 p-3 text-sm">
													{company.notes}
												</div>
											</div>
										)}
									</>
								)}
							</CardContent>
						</Card>

						{/* Resume */}
						{company.resumes.length > 0 && (
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<FileText className="h-5 w-5" />
										Resume ({company.resumes.length})
									</CardTitle>
									<CardDescription>
										Resume generated for this application
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									{company.resumes.map((resume) => (
										<div
											key={resume.id}
											className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/50 p-4"
										>
											<div>
												<p className="font-medium">{resume.title}</p>
												<p className="text-sm text-muted-foreground">
													Template: {resume.template}
													{resume.source === "import" ? " (imported PDF)" : ""} • Created{" "}
													{formatDate(resume.created_at)}
												</p>
												<div className="mt-1 flex flex-wrap items-center gap-2">
													<PdfStatusBadge
														documentId={resume.id}
														documentType="resume"
														initial={{
															pdf_status: resume.pdf_status ?? (resume.pdf_url ? "ready" : "none"),
															pdf_error: resume.pdf_error ?? null,
															pdf_url: resume.pdf_url,
														}}
														onChange={(st) => applyPdfStatus("resumes", resume.id, st)}
													/>
													<Link
														href={`/documents/${resume.id}?type=resume`}
														className="text-xs text-primary hover:underline"
													>
														Edit
													</Link>
												</div>
											</div>
											<div className="flex gap-2">
												<Button variant="default" size="sm" onClick={() => handleViewResume(resume)}>
													<Eye className="mr-1 h-4 w-4" />
													View
												</Button>
												<Button variant="outline" size="sm" onClick={() => handleDownloadResume(resume)}>
													<Download className="mr-1 h-4 w-4" />
													PDF
												</Button>
												{resume.docx_url && (
													<Button variant="outline" size="sm" asChild>
														<a href={resume.docx_url} download>
															<Download className="mr-1 h-4 w-4" />
															DOCX
														</a>
													</Button>
												)}
											</div>
										</div>
									))}
								</CardContent>
							</Card>
						)}

						{/* Cover Letter */}
						{company.cover_letters.length > 0 && (
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Mail className="h-5 w-5" />
										Cover Letter ({company.cover_letters.length})
									</CardTitle>
									<CardDescription>
										Cover letter generated for this application
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									{company.cover_letters.map((letter) => (
										<div
											key={letter.id}
											className="rounded-lg border bg-background/50 p-4"
										>
											<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
												<div>
													<p className="font-medium">{letter.title}</p>
													<p className="text-sm text-muted-foreground">
														Created {formatDate(letter.created_at)}
													</p>
													<div className="mt-1 flex flex-wrap items-center gap-2">
														<PdfStatusBadge
															documentId={letter.id}
															documentType="cover_letter"
															initial={{
																pdf_status: letter.pdf_status ?? (letter.pdf_url ? "ready" : "none"),
																pdf_error: letter.pdf_error ?? null,
																pdf_url: letter.pdf_url,
															}}
															onChange={(st) => applyPdfStatus("cover_letters", letter.id, st)}
														/>
														<Link
															href={`/documents/${letter.id}?type=cover_letter`}
															className="text-xs text-primary hover:underline"
														>
															Edit
														</Link>
													</div>
												</div>
												<div className="flex gap-2">
													{letter.pdf_url && (
														<>
															<Button
																variant="default"
																size="sm"
																onClick={() => {
																	setPdfViewerUrl(letter.pdf_url);
																	setPdfViewerTitle(letter.title);
																}}
															>
																<Eye className="mr-1 h-4 w-4" />
																View
															</Button>
															<Button variant="outline" size="sm" asChild>
																<a href={letter.pdf_url} download>
																	<Download className="mr-1 h-4 w-4" />
																	PDF
																</a>
															</Button>
														</>
													)}
													{letter.docx_url && (
														<Button variant="outline" size="sm" asChild>
															<a href={letter.docx_url} download>
																<Download className="mr-1 h-4 w-4" />
																DOCX
															</a>
														</Button>
													)}
												</div>
											</div>
											{letter.content && !letter.pdf_url && (
												<div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/50 p-3 text-sm">
													<pre className="whitespace-pre-wrap font-sans">
														{letter.content}
													</pre>
												</div>
											)}
										</div>
									))}
								</CardContent>
							</Card>
						)}
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Quick Stats */}
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="text-lg">Quick Stats</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="flex items-center justify-between rounded-lg border p-3">
									<div className="flex items-center gap-2">
										<FileText className="h-4 w-4 text-primary" />
										<span className="text-sm">Resumes</span>
									</div>
									<span className="font-semibold">
										{company.resumes.length}
									</span>
								</div>
								<div className="flex items-center justify-between rounded-lg border p-3">
									<div className="flex items-center gap-2">
										<Mail className="h-4 w-4 text-primary" />
										<span className="text-sm">Cover Letters</span>
									</div>
									<span className="font-semibold">
										{company.cover_letters.length}
									</span>
								</div>
								<div className="flex items-center justify-between rounded-lg border p-3">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-primary" />
										<span className="text-sm">Created</span>
									</div>
									<span className="text-sm">
										{formatDate(company.created_at)}
									</span>
								</div>
								<div className="flex items-center justify-between rounded-lg border p-3">
									<div className="flex items-center gap-2">
										<Clock className="h-4 w-4 text-primary" />
										<span className="text-sm">Last Updated</span>
									</div>
									<span className="text-sm">
										{formatDate(company.updated_at)}
									</span>
								</div>
							</CardContent>
						</Card>

						{/* Quick Actions */}
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="text-lg">Quick Actions</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<Button
									className="w-full justify-start"
									variant="outline"
									asChild
								>
									<Link href="/generate">
										<FileText className="mr-2 h-4 w-4" />
										Generate New Resume
									</Link>
								</Button>
								{company.job_url && (
									<Button
										className="w-full justify-start"
										variant="outline"
										asChild
									>
										<a
											href={company.job_url}
											target="_blank"
											rel="noopener noreferrer"
										>
											<ExternalLink className="mr-2 h-4 w-4" />
											View Job Posting
										</a>
									</Button>
								)}
							</CardContent>
						</Card>

						{/* Timeline */}
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="text-lg">Timeline</CardTitle>
								<CardDescription>Application history</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{/* Application Created */}
									<div className="flex gap-3">
										<div className="flex flex-col items-center">
											<div className="h-2 w-2 rounded-full bg-primary" />
											<div className="h-full w-px bg-border" />
										</div>
										<div className="pb-4">
											<p className="text-sm font-medium">Application Created</p>
											<p className="text-xs text-muted-foreground">
												{new Date(company.created_at).toLocaleString("en-US", {
													month: "short",
													day: "numeric",
													year: "numeric",
													hour: "numeric",
													minute: "2-digit",
												})}
											</p>
										</div>
									</div>

									{/* Status History */}
									{company.status_history &&
										company.status_history.length > 0 &&
										company.status_history.map((entry, idx) => {
											const getStatusDotColor = (status: string) => {
												switch (status) {
													case "saved":
														return "bg-secondary";
													case "applied":
														return "bg-blue-500";
													case "interviewing":
														return "bg-green-500";
													case "offered":
														return "bg-purple-500";
													case "rejected":
														return "bg-red-500";
													case "withdrawn":
														return "bg-muted-foreground";
													default:
														return "bg-primary";
												}
											};
											const isLast = idx === company.status_history!.length - 1;
											return (
												<div
													key={`status-${entry.changed_at}`}
													className="flex gap-3"
												>
													<div className="flex flex-col items-center">
														<div
															className={cn(
																"h-2 w-2 rounded-full",
																getStatusDotColor(entry.to)
															)}
														/>
														{!isLast && (
															<div className="h-full w-px bg-border" />
														)}
													</div>
													<div className={isLast ? "" : "pb-4"}>
														<p className="text-sm font-medium flex items-center gap-1">
															<span className="capitalize">{entry.from}</span>
															<ArrowRight className="h-3 w-3" />
															<span className="capitalize">{entry.to}</span>
														</p>
														<p className="text-xs text-muted-foreground">
															{new Date(entry.changed_at).toLocaleString(
																"en-US",
																{
																	month: "short",
																	day: "numeric",
																	year: "numeric",
																	hour: "numeric",
																	minute: "2-digit",
																}
															)}
														</p>
													</div>
												</div>
											);
										})}
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>

			{/* Delete Modal */}
			<Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<Trash2 className="h-5 w-5" />
							Delete Application
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete the application for{" "}
							<strong>{company.job_title || "this position"}</strong> at{" "}
							<strong>{company.name}</strong>? This will also delete all
							associated resumes and cover letters. This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowDeleteModal(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
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

			{/* PDF Viewer Modal */}
			<Dialog open={!!pdfViewerUrl} onOpenChange={() => setPdfViewerUrl(null)}>
				<DialogContent className="max-w-4xl h-[90vh]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							{pdfViewerTitle}
						</DialogTitle>
					</DialogHeader>
					<div className="flex-1 min-h-0 h-full">
						{pdfViewerUrl && (
							<iframe
								src={`${pdfViewerUrl}${
									pdfViewerUrl.includes("?") ? "&" : "?"
								}view=true`}
								className="w-full h-[calc(90vh-120px)] rounded-lg border"
								title={pdfViewerTitle}
							/>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" asChild>
							<a href={pdfViewerUrl || "#"} download>
								<Download className="mr-2 h-4 w-4" />
								Download
							</a>
						</Button>
						<Button onClick={() => setPdfViewerUrl(null)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Interview Round Modal */}
			<Dialog open={showInterviewModal} onOpenChange={setShowInterviewModal}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CalendarIcon className="h-5 w-5" />
							{editingInterviewIndex === null
								? "Schedule Interview"
								: "Edit Interview"}
						</DialogTitle>
						<DialogDescription>
							Select the date and time for the interview round.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Date</Label>
							<div className="flex justify-center border rounded-md p-3 bg-muted/30">
								<CalendarComponent
									selected={interviewModalDate}
									onSelect={setInterviewModalDate}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Time</Label>
							<div className="flex gap-2">
								<Select
									value={interviewModalHour}
									onValueChange={setInterviewModalHour}
								>
									<SelectTrigger className="w-[80px]">
										<SelectValue placeholder="Hour" />
									</SelectTrigger>
									<SelectContent>
										{Array.from({ length: 12 }, (_, i) => {
											const hour = (i + 1).toString().padStart(2, "0");
											return (
												<SelectItem key={hour} value={hour}>
													{hour}
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
								<span className="flex items-center text-muted-foreground">
									:
								</span>
								<Select
									value={interviewModalMinute}
									onValueChange={setInterviewModalMinute}
								>
									<SelectTrigger className="w-[80px]">
										<SelectValue placeholder="Min" />
									</SelectTrigger>
									<SelectContent>
										{["00", "15", "30", "45"].map((min) => (
											<SelectItem key={min} value={min}>
												{min}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									value={interviewModalPeriod}
									onValueChange={(v: "AM" | "PM") => setInterviewModalPeriod(v)}
								>
									<SelectTrigger className="w-[80px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="AM">AM</SelectItem>
										<SelectItem value="PM">PM</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Notes (optional)</Label>
							<Textarea
								placeholder="e.g., Technical round with engineering team"
								value={interviewModalNotes}
								onChange={(e) => setInterviewModalNotes(e.target.value)}
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowInterviewModal(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={saveInterviewFromModal}
							disabled={!interviewModalDate}
						>
							{editingInterviewIndex === null ? "Add" : "Update"} Interview
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

