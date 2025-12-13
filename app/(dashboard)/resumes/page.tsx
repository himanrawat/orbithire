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
	FileText,
	Sparkles,
	Search,
	ChevronRight,
	Download,
	Eye,
	Trash2,
	MoreVertical,
	Calendar,
	X,
	Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// Data types
type Resume = {
	id: string;
	title: string;
	companyName: string | null;
	template: string;
	country: string;
	pdfUrl: string | null;
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
		fetchResumes();
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

	return (
		<div className="min-h-screen">
			<GridBackground />

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

			<div className="relative px-6 py-8">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
				>
					<div>
						<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
							<FileText className="h-8 w-8 text-primary" />
							My Resumes
						</h1>
						<p className="mt-1 text-muted-foreground">
							View and manage all your generated resumes
						</p>
					</div>
					<Button asChild>
						<Link href="/generate">
							<Sparkles className="mr-2 h-4 w-4" />
							Generate New Resume
						</Link>
					</Button>
				</motion.div>

				{/* Search */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-6"
				>
					<Card className="border-border/50 bg-card/80 backdrop-blur">
						<CardContent className="p-4">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search resumes..."
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
					{loading ? (
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardContent className="flex items-center justify-center py-16">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
							</CardContent>
						</Card>
					) : filteredResumes.length > 0 ? (
						<div className="space-y-4">
							{filteredResumes.map((resume) => (
								<Card
									key={resume.id}
									className="border-border/50 bg-card/80 backdrop-blur"
								>
									<CardContent className="flex items-center justify-between p-6">
										<div className="flex items-center gap-4">
											<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
												<FileText className="h-6 w-6 text-primary" />
											</div>
											<div>
												<h3 className="font-semibold">{resume.title}</h3>
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													{resume.companyName && (
														<>
															<span>{resume.companyName}</span>
															<span>·</span>
														</>
													)}
													<span>{resume.template}</span>
													<span>·</span>
													<span>{resume.country}</span>
												</div>
												<div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
													<Calendar className="h-3 w-3" />
													<span>Created {resume.createdAt}</span>
												</div>
											</div>
										</div>
										<div className="flex items-center gap-2">
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
												onClick={() => handleDelete(resume.id)}
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
					) : (
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardContent className="flex flex-col items-center justify-center py-16 text-center">
								<FileText className="mb-4 h-16 w-16 text-muted-foreground/50" />
								<h3 className="mb-2 text-lg font-semibold">
									{searchQuery ? "No resumes found" : "No resumes yet"}
								</h3>
								<p className="mb-6 max-w-sm text-muted-foreground">
									{searchQuery
										? "Try adjusting your search"
										: "Generate your first AI-tailored resume to get started."}
								</p>
								{!searchQuery && (
									<Button asChild>
										<Link href="/generate">
											<Sparkles className="mr-2 h-4 w-4" />
											Generate Your First Resume
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
