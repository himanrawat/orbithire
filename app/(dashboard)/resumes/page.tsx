"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/blocks";
import {
	Card,
	CardContent
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	FileText,
	Sparkles,
	Search,
	Download,
	Eye,
	Trash2,
	Calendar,
	X,
	Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { PdfStatusBadge } from "@/components/PdfStatusBadge";
import type { PdfStatus } from "@/lib/types/database";

// Data types
type Resume = {
	id: string;
	title: string;
	companyName: string | null;
	template: string;
	country: string;
	pdfUrl: string | null;
	imported: boolean;
	pdfStatus: PdfStatus;
	pdfError: string | null;
	createdAt: string;
	updatedAt: string;
};

export default function ResumesPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [resumes, setResumes] = useState<Resume[]>([]);
	const [loading, setLoading] = useState(true);
	const [viewingPdf, setViewingPdf] = useState<{
		url: string;
		title: string;
	} | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);

	useEffect(() => {
		void fetchResumes();
	}, []);

	const fetchResumes = async () => {
		try {
			const supabase = getSupabaseBrowserClient();
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) return;

			const { data, error } = await supabase
				.from("resumes")
				.select(
					`
					id,
					title,
					template,
					country,
					pdf_url,
					source,
					pdf_status,
					pdf_error,
					created_at,
					updated_at,
					companies (
						name
					)
				`
				)
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching resumes:", error);
				return;
			}

			const mappedResumes: Resume[] = (data || []).map((r: any) => ({
				id: r.id,
				title: r.title || "Untitled Resume",
				companyName: r.companies?.name || null,
				template: r.template || "default",
				country: r.country || "US",
				pdfUrl: r.pdf_url,
				imported: r.source === "import",
				pdfStatus: r.pdf_status || (r.pdf_url ? "ready" : "none"),
				pdfError: r.pdf_error ?? null,
				createdAt: new Date(r.created_at).toLocaleDateString(),
				updatedAt: new Date(r.updated_at).toLocaleDateString(),
			}));

			setResumes(mappedResumes);
		} catch (error) {
			console.error("Error fetching resumes:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async (resumeId: string) => {
		if (!confirm("Are you sure you want to delete this resume?")) return;

		setDeleting(resumeId);
		try {
			const supabase = getSupabaseBrowserClient();
			const { error } = await supabase
				.from("resumes")
				.delete()
				.eq("id", resumeId);

			if (error) {
				console.error("Error deleting resume:", error);
				alert("Failed to delete resume");
				return;
			}

			setResumes(resumes.filter((r) => r.id !== resumeId));
		} catch (error) {
			console.error("Error deleting resume:", error);
		} finally {
			setDeleting(null);
		}
	};

	const filteredResumes = resumes.filter(
		(resume) =>
			resume.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			resume.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
	);
	const hasResumes = !loading && filteredResumes.length > 0;
	const showEmptyState = !loading && filteredResumes.length === 0;

	return (
		<div className="min-h-screen">

			{/* PDF Viewer Modal */}
			{viewingPdf && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<div className="relative h-[90vh] w-[90vw] max-w-5xl rounded-lg bg-background p-4 shadow-xl">
						<div className="mb-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold">{viewingPdf.title}</h3>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setViewingPdf(null)}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
						<iframe
							src={`${viewingPdf.url}?view=true`}
							className="h-[calc(100%-3rem)] w-full rounded border"
							title="PDF Viewer"
						/>
					</div>
				</div>
			)}

			<div className="relative mx-auto max-w-6xl px-4 py-8 md:px-8">
				<PageHeader
					icon={<FileText />}
					title="My resumes"
					description="Every resume you've generated or imported, with its PDF."
					actions={
						<Button variant="cap" asChild>
							<Link href="/generate">
								<Sparkles className="h-4 w-4" />
								Generate a resume
							</Link>
						</Button>
					}
				/>

				{/* Search */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-6"
				>
					<Card>
						<CardContent className="p-4">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search resumes"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9"
								/>
							</div>
						</CardContent>
					</Card>
				</motion.div>

				{/* Resumes List */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					{loading && (
						<Card>
							<CardContent className="flex items-center justify-center py-16">
								<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
							</CardContent>
						</Card>
					)}
					{hasResumes && (
						<div className="space-y-4">
							{filteredResumes.map((resume) => (
								<Card
									key={resume.id}
									
								>
									<CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
										<div className="flex min-w-0 items-center gap-4">
											<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
												<FileText className="h-6 w-6 text-primary" />
											</div>
											<div className="min-w-0">
												<h3 className="font-semibold">{resume.title}</h3>
												<div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
													{resume.companyName && (
														<>
															<span>{resume.companyName}</span>
															<span>·</span>
														</>
													)}
													<span>
														{resume.template}
														{resume.imported ? " (imported PDF)" : ""}
													</span>
													<span>·</span>
													<span>{resume.country}</span>
												</div>
												<div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
													<Calendar className="h-3 w-3" />
													<span>Created {resume.createdAt}</span>
												</div>
												<div className="mt-1 flex items-center gap-2">
													<PdfStatusBadge
														documentId={resume.id}
														documentType="resume"
														initial={{ pdf_status: resume.pdfStatus, pdf_error: resume.pdfError, pdf_url: resume.pdfUrl }}
														onChange={(st) =>
															setResumes((prev) =>
																prev.map((r) =>
																	r.id === resume.id ? { ...r, pdfUrl: st.pdf_url, pdfStatus: st.pdf_status, pdfError: st.pdf_error } : r
																)
															)
														}
													/>
													<Link href={`/documents/${resume.id}?type=resume`} className="text-xs text-primary hover:underline">
														Edit
													</Link>
												</div>
											</div>
										</div>
										<div className="flex items-center gap-2 self-end sm:self-auto">
											<Button
												variant="ghost"
												size="icon"
												onClick={() =>
													resume.pdfUrl &&
													setViewingPdf({
														url: resume.pdfUrl,
														title: resume.title,
													})
												}
												disabled={!resume.pdfUrl}
												title={resume.pdfUrl ? "View PDF" : "No PDF available"}
											>
												<Eye className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() =>
													resume.pdfUrl && window.open(resume.pdfUrl, "_blank")
												}
												disabled={!resume.pdfUrl}
												title={
													resume.pdfUrl ? "Download PDF" : "No PDF available"
												}
											>
												<Download className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
											onClick={() => void handleDelete(resume.id)}
												disabled={deleting === resume.id}
												title="Delete resume"
											>
												{deleting === resume.id ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
					{showEmptyState && (
						<Card>
							<EmptyState
								title={searchQuery ? "No resumes found" : "No resumes yet"}
								description={searchQuery ? "Try a different search." : "Generate your first tailored resume to get started."}
								action={
									!searchQuery ? (
										<Button asChild>
											<Link href="/generate">
												<Sparkles className="h-4 w-4" />
												Generate your first resume
											</Link>
										</Button>
									) : undefined
								}
							/>
						</Card>
					)}
				</motion.div>
			</div>
		</div>
	);
}
