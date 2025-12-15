"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import {
	Sparkles,
	Building2,
	ArrowRight,
	ArrowLeft,
	CheckCircle2,
	Loader2,
	Wand2,
	FileText,
	Download,
	Eye,
	Copy,
	Calendar,
	DollarSign,
	Link as LinkIcon,
	Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sampleResume, type JSONResume } from "@/lib/sampleResume";
import { TemplateGallery } from "@/components/TemplateGallery";
import { ResumePreview, type ResumeTemplate } from "@/components/ResumePreview";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";

type ApplicationStatus =
	| "saved"
	| "applied"
	| "interviewing"
	| "offered"
	| "rejected"
	| "withdrawn";

type Step = "job-details" | "select-template" | "generating" | "preview";

interface GeneratedContent {
	resume: {
		extractedKeywords?: string[];
		label: string;
		summary: string;
		workHighlights: Record<string, string[]>;
		skillsOrdered: string[];
		customSectionHighlights?: Record<string, string[]>;
	};
	coverLetter: string;
	profile: {
		name: string;
		email: string;
		phone: string;
		location: string;
		linkedin?: string;
		website?: string;
		image?: string;
		experience: Array<{
			company: string;
			title: string;
			startDate: string;
			endDate?: string;
			highlights: string[];
		}>;
		education: Array<{
			institution: string;
			degree: string;
			field: string;
			endDate?: string;
		}>;
		skills: string[];
		customSections?: Array<{
			title: string;
			entries: Array<{ title: string; description: string }>;
		}>;
	};
}

// Template definitions - using working themes only
const templates: ResumeTemplate[] = [
	{
		id: "standard",
		name: "Standard",
		style: "Classic",
		description:
			"The official reference theme - clean, professional, and widely recognized",
		tags: ["Official", "ATS-Friendly", "Classic"],
		previewHtml: "",
	},
	{
		id: "professional",
		name: "Professional",
		style: "Executive",
		description:
			"Modern and elegant design with great typography for senior roles",
		tags: ["Executive", "Corporate", "Premium"],
		previewHtml: "",
	},
	{
		id: "even",
		name: "Even",
		style: "Modern Flat",
		description:
			"Clean, flat design with excellent readability and modern aesthetics",
		tags: ["Modern", "ATS-Friendly", "Popular"],
		previewHtml: "",
	},
	{
		id: "elegant",
		name: "Elegant",
		style: "Minimalist",
		description: "Detailed, professional layout with comprehensive sections",
		tags: ["Corporate", "Detailed", "Executive"],
		previewHtml: "",
	},
	{
		id: "flat",
		name: "Flat",
		style: "Contemporary",
		description: "Contemporary flat design with clean lines and bold sections",
		tags: ["Modern", "Clean", "Tech"],
		previewHtml: "",
	},
	{
		id: "spartacus",
		name: "Spartacus",
		style: "Bold",
		description: "Bold and impactful layout with strong visual hierarchy",
		tags: ["Bold", "Visual", "Standout"],
		previewHtml: "",
	},
	{
		id: "paper",
		name: "Paper",
		style: "Minimal",
		description: "Minimal paper-like design focused purely on content",
		tags: ["Minimal", "Print-Ready", "Clean"],
		previewHtml: "",
	},
	{
		id: "compact",
		name: "Compact",
		style: "ATS-Optimized",
		description:
			"Single column, keyword-dense format optimized for ATS systems",
		tags: ["ATS-Friendly", "1 Page", "US Format"],
		previewHtml: "",
	},
	{
		id: "modern",
		name: "Modern",
		style: "Two-Column",
		description:
			"Sleek sidebar layout with skills and contact prominently displayed",
		tags: ["Visual", "Tech", "Startups"],
		previewHtml: "",
	},
];

export default function GeneratePage() {
	const router = useRouter();
	const [step, setStep] = useState<Step>("job-details");
	const [form, setForm] = useState({
		companyName: "",
		jobTitle: "",
		jobDescription: "",
		recruiterName: "",
	});
	const [selectedTemplateId, setSelectedTemplateId] = useState("standard");
	const [isGenerating, setIsGenerating] = useState(false);
	const [generatedContent, setGeneratedContent] =
		useState<GeneratedContent | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showPreview, setShowPreview] = useState(false);
	const [previewResume, setPreviewResume] = useState<JSONResume | null>(null);
	const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(
		null
	);
	const [copied, setCopied] = useState<"resume" | "cover" | null>(null);

	// Track Application Modal state
	const [showTrackModal, setShowTrackModal] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [trackForm, setTrackForm] = useState({
		status: "applied" as ApplicationStatus,
		appliedAt: new Date().toISOString().split("T")[0],
		jobUrl: "",
		salaryRange: "",
		notes: "",
		followUpDate: "",
	});

	// Editable content state - Resume
	const [editedLabel, setEditedLabel] = useState("");
	const [editedSummary, setEditedSummary] = useState("");
	const [editedSkills, setEditedSkills] = useState<string[]>([]);
	const [editedExperience, setEditedExperience] = useState<
		Array<{
			company: string;
			title: string;
			startDate: string;
			endDate?: string;
			highlights: string[];
		}>
	>([]);
	const [editedEducation, setEditedEducation] = useState<
		Array<{
			institution: string;
			degree: string;
			field: string;
			endDate?: string;
		}>
	>([]);
	const [editedProjects, setEditedProjects] = useState<
		Array<{
			name: string;
			description: string;
			highlights: string[];
			url?: string;
		}>
	>([]);

	// Editable content state - Cover Letter
	const [editedCoverLetter, setEditedCoverLetter] = useState("");

	// No longer need templatesWithPreviews - TemplateGallery fetches its own previews

	const canProceed =
		form.companyName.trim().length > 1 &&
		form.jobTitle.trim().length > 1 &&
		form.jobDescription.trim().length > 20;

	const handleGenerate = async () => {
		setStep("generating");
		setIsGenerating(true);
		setError(null);

		try {
			const response = await fetch("/api/generate/resume", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					jobTitle: form.jobTitle.trim(),
					jobDescription: form.jobDescription.trim(),
					companyName: form.companyName.trim(),
					recruiterName: form.recruiterName.trim() || undefined,
					templateId: selectedTemplateId,
					generateCoverLetter: true,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to generate content");
			}

			setGeneratedContent(data);

			// Initialize editable resume content with generated/profile values
			setEditedLabel(data.resume?.label || "");
			setEditedSummary(data.resume?.summary || "");
			setEditedSkills(data.resume?.skillsOrdered || data.profile?.skills || []);

			// Initialize experience with AI-optimized highlights
			const experienceWithHighlights = (data.profile?.experience || []).map(
				(exp: any) => ({
					...exp,
					highlights:
						data.resume?.workHighlights?.[exp.company] || exp.highlights || [],
				})
			);
			setEditedExperience(experienceWithHighlights);

			setEditedEducation(data.profile?.education || []);

			// Initialize projects from custom sections
			const projectsFromSections = (data.profile?.customSections || []).flatMap(
				(section: any) => {
					const optimizedHighlights =
						data.resume?.customSectionHighlights?.[section.title] || [];
					return section.entries.map((entry: any, index: number) => {
						const rawHighlight =
							optimizedHighlights.length > index
								? optimizedHighlights[index]
								: entry.description || entry.title || "";

						const highlights = normalizeHighlights(rawHighlight);

						const urlFromEntry = sanitizeUrl(entry.url);
						const urlFromText = sanitizeUrl(extractUrlFromText(rawHighlight));

						return {
							name: entry.title,
							description: "",
							url: urlFromEntry || urlFromText || "",
							highlights,
						};
					});
				}
			);
			setEditedProjects(projectsFromSections);

			// Initialize cover letter
			setEditedCoverLetter(data.coverLetter || "");

			setStep("preview");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setStep("select-template");
		} finally {
			setIsGenerating(false);
		}
	};

	// Build the full JSONResume from EDITED content (user can modify before download)
	const finalResume = useMemo((): JSONResume | null => {
		if (!generatedContent) return null;

		const { profile } = generatedContent;

		// Build projects with keywords
		const projects = editedProjects.map((proj) => {
			const highlights =
				proj.highlights && proj.highlights.length > 0
					? proj.highlights
					: normalizeHighlights(proj.description);

			return {
				name: proj.name,
				description: "",
				highlights,
				url: proj.url || undefined,
				keywords: [],
			};
		});

		return {
			basics: {
				name: profile.name,
				label: editedLabel,
				image: profile.image,
				email: profile.email,
				phone: profile.phone,
				url: profile.website,
				summary: editedSummary,
				location: {
					city: profile.location || "",
					countryCode: "US",
				},
				profiles: profile.linkedin
					? [{ network: "LinkedIn", username: "", url: profile.linkedin }]
					: [],
			},
			work: editedExperience.map((exp) => ({
				name: exp.company,
				position: exp.title,
				startDate: exp.startDate,
				endDate: exp.endDate,
				highlights: exp.highlights,
			})),
			education: editedEducation.map((edu) => ({
				institution: edu.institution,
				area: edu.field,
				studyType: edu.degree,
				startDate: "",
				endDate: edu.endDate,
			})),
			skills: groupSkillsFromArray(editedSkills),
			projects: projects.length > 0 ? projects : undefined,
		};
	}, [
		generatedContent,
		editedLabel,
		editedSummary,
		editedSkills,
		editedExperience,
		editedEducation,
		editedProjects,
	]);

	const handleCopy = (type: "resume" | "cover") => {
		if (!generatedContent) return;

		if (type === "cover") {
			navigator.clipboard.writeText(
				editedCoverLetter || generatedContent.coverLetter
			);
		} else {
			// Copy resume as text summary
			const text = `${generatedContent.profile.name}\n${
				generatedContent.resume.label
			}\n\n${editedSummary || generatedContent.resume.summary}`;
			navigator.clipboard.writeText(text);
		}

		setCopied(type);
		setTimeout(() => setCopied(null), 2000);
	};

	// Handle opening preview for any template (uses sample data for template selection step)
	const handleTemplatePreview = (templateId: string) => {
		setPreviewTemplateId(templateId);
		setPreviewResume(sampleResume);
		setShowPreview(true);
	};

	// Handle opening preview after generation (uses generated data)
	const handleOpenPreview = () => {
		if (finalResume) {
			setPreviewTemplateId(selectedTemplateId);
			setPreviewResume(finalResume);
			setShowPreview(true);
		}
	};

	// Handle PDF download
	const handleDownloadPDF = async () => {
		if (!finalResume) return;

		try {
			// Fetch the rendered HTML from the API
			const response = await fetch("/api/resume/render", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					resume: finalResume,
					templateId: selectedTemplateId,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to render resume");
			}

			const { html } = await response.json();

			// Open a new window with the HTML and trigger print (save as PDF)
			const printWindow = window.open("", "_blank");
			if (printWindow) {
				printWindow.document.write(html);
				printWindow.document.close();
				printWindow.onload = () => {
					printWindow.print();
				};
			}
		} catch (err) {
			console.error("Download failed:", err);
			setError("Failed to download PDF. Please try again.");
		}
	};

	// Handle saving application to track
	const handleSaveApplication = async () => {
		if (!finalResume || !generatedContent) return;

		setIsSaving(true);
		setError(null);

		try {
			const response = await fetch("/api/companies", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: form.companyName.trim(),
					status: trackForm.status,
					jobTitle: form.jobTitle.trim(),
					jobDescription: form.jobDescription.trim(),
					jobUrl: trackForm.jobUrl.trim() || null,
					recruiterName: form.recruiterName.trim() || null,
					salaryRange: trackForm.salaryRange.trim() || null,
					notes: trackForm.notes.trim() || null,
					appliedAt:
						trackForm.status === "applied" ? trackForm.appliedAt : null,
					followUpDate: trackForm.followUpDate || null,
					resume: finalResume,
					coverLetter: editedCoverLetter,
					templateId: selectedTemplateId,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to save application");
			}

			setShowTrackModal(false);
			router.push("/companies");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save application"
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="">
			<GridBackground />

			<div className="relative">
				{/* Profile Completion Warning */}
				<div className="container mx-auto max-w-4xl px-4 pt-6">
					<ProfileCompletionBanner variant="popup" />
				</div>

				{/* Progress indicator */}
				<div className="my-6 flex items-center justify-center gap-2">
					{["job-details", "select-template", "preview"].map((s, i) => (
						<div key={s} className="flex items-center">
							<div
								className={cn(
									"flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
									step === s ||
										(step === "generating" && s === "select-template")
										? "bg-primary text-primary-foreground"
										: i <
										  ["job-details", "select-template", "preview"].indexOf(
												step
										  )
										? "bg-primary/20 text-primary"
										: "bg-muted text-muted-foreground"
								)}
							>
								{i <
								["job-details", "select-template", "preview"].indexOf(step) ? (
									<CheckCircle2 className="h-4 w-4" />
								) : (
									i + 1
								)}
							</div>
							{i < 2 && (
								<div
									className={cn(
										"mx-2 h-0.5 w-12",
										i <
											["job-details", "select-template", "preview"].indexOf(
												step
											)
											? "bg-primary"
											: "bg-muted"
									)}
								/>
							)}
						</div>
					))}
				</div>

				{/* Step 1: Job Details */}
				<AnimatePresence mode="wait">
					{step === "job-details" && (
						<motion.div
							key="job-details"
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -20 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-2xl">
										<FileText className="h-5 w-5 text-primary" />
										Job Details
									</CardTitle>
									<CardDescription>
										Enter the job information. We&apos;ll use this to tailor
										your resume.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="companyName">Company Name</Label>
											<Input
												id="companyName"
												placeholder="e.g., Acme Corp"
												value={form.companyName}
												onChange={(e) =>
													setForm({ ...form, companyName: e.target.value })
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="jobTitle">Job Title</Label>
											<Input
												id="jobTitle"
												placeholder="e.g., Senior Frontend Engineer"
												value={form.jobTitle}
												onChange={(e) =>
													setForm({ ...form, jobTitle: e.target.value })
												}
											/>
										</div>
									</div>

									<div className="space-y-2">
										<Label htmlFor="jobDescription">Job Description</Label>
										<Textarea
											id="jobDescription"
											rows={8}
											placeholder="Paste the full job description here. The more detail, the better we can tailor your resume..."
											value={form.jobDescription}
											onChange={(e) =>
												setForm({ ...form, jobDescription: e.target.value })
											}
										/>
										<p className="text-xs text-muted-foreground">
											{form.jobDescription.length} characters
											{form.jobDescription.length < 100 &&
												" (add more for better results)"}
										</p>
									</div>

									<div className="space-y-2">
										<Label htmlFor="recruiterName">
											Recruiter/Hiring Manager Name (optional)
										</Label>
										<Input
											id="recruiterName"
											placeholder="e.g., Jane Doe"
											value={form.recruiterName}
											onChange={(e) =>
												setForm({ ...form, recruiterName: e.target.value })
											}
										/>
										<p className="text-xs text-muted-foreground">
											Used to personalize the cover letter greeting
										</p>
									</div>

									<div className="flex justify-end">
										<Button
											onClick={() => setStep("select-template")}
											disabled={!canProceed}
										>
											Choose Template
											<ArrowRight className="ml-2 h-4 w-4" />
										</Button>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					)}

					{/* Step 2: Template Selection */}
					{step === "select-template" && (
						<motion.div
							key="select-template"
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 20 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-2xl">
										<Sparkles className="h-5 w-5 text-primary" />
										Choose Your Template
									</CardTitle>
									<CardDescription>
										Select a template style. Previews show sample data. Your
										real content will be generated by AI.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									{error && (
										<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
											{error}
										</div>
									)}

									<TemplateGallery
										templates={templates}
										selectedId={selectedTemplateId}
										onSelect={setSelectedTemplateId}
										onPreview={handleTemplatePreview}
									/>

									<div className="flex justify-between">
										<Button
											variant="outline"
											onClick={() => setStep("job-details")}
										>
											<ArrowLeft className="mr-2 h-4 w-4" />
											Back
										</Button>
										<Button onClick={handleGenerate}>
											<Wand2 className="mr-2 h-4 w-4" />
											Generate with AI
										</Button>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					)}

					{/* Step 3: Generating */}
					{step === "generating" && (
						<motion.div
							key="generating"
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardContent className="flex flex-col items-center justify-center py-20">
									<div className="relative">
										<Loader2 className="h-16 w-16 animate-spin text-primary" />
										<Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary" />
									</div>
									<h3 className="mt-6 text-xl font-semibold">
										Generating Your Resume
									</h3>
									<p className="mt-2 text-muted-foreground">
										AI is analyzing the job description and tailoring your
										experience...
									</p>
									<div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
										<div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
										Fetching your profile data
									</div>
									<div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
										<div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
										Optimizing for ATS keywords
									</div>
									<div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
										<div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
										Writing cover letter
									</div>
								</CardContent>
							</Card>
						</motion.div>
					)}

					{/* Step 4: Preview */}
					{step === "preview" && generatedContent && (
						<motion.div
							key="preview"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 20 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<div className="flex items-center justify-between">
										<div>
											<CardTitle className="flex items-center gap-2 text-2xl">
												<CheckCircle2 className="h-5 w-5 text-green-500" />
												Your Resume is Ready!
											</CardTitle>
											<CardDescription>
												Tailored for {form.jobTitle} at {form.companyName}
											</CardDescription>
										</div>
										<div className="flex gap-2">
											{/* <Button variant="outline" onClick={handleOpenPreview}>
												<Eye className="mr-2 h-4 w-4" />
												Full Preview
											</Button> */}
											<Button onClick={handleDownloadPDF}>
												<Download className="mr-2 h-4 w-4" />
												Download PDF
											</Button>
										</div>
									</div>
								</CardHeader>
								<CardContent className="space-y-8">
									{/* ==================== RESUME SECTION ==================== */}
									<div className="rounded-lg border-2 border-primary/20 bg-background/60 p-6">
										<div className="flex items-center justify-between mb-6">
											<h2 className="text-xl font-bold flex items-center gap-2">
												<FileText className="h-5 w-5 text-primary" />
												Resume
											</h2>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleCopy("resume")}
											>
												{copied === "resume" ? (
													<CheckCircle2 className="h-4 w-4 text-green-500" />
												) : (
													<Copy className="h-4 w-4" />
												)}
											</Button>
										</div>

										{/* Professional Label */}
										<div className="mb-4">
											<Label className="text-xs text-muted-foreground uppercase tracking-wide">
												Title/Label
											</Label>
											<Input
												value={editedLabel}
												onChange={(e) => setEditedLabel(e.target.value)}
												className="mt-1"
											/>
										</div>

										{/* Professional Summary */}
										<div className="mb-4">
											<Label className="text-xs text-muted-foreground uppercase tracking-wide">
												Professional Summary
											</Label>
											<Textarea
												value={editedSummary}
												onChange={(e) => setEditedSummary(e.target.value)}
												className="mt-1 min-h-[100px]"
											/>
										</div>

										{/* Skills */}
										<div className="mb-4">
											<Label className="text-xs text-muted-foreground uppercase tracking-wide">
												Skills (comma-separated)
											</Label>
											<Textarea
												value={editedSkills.join(", ")}
												onChange={(e) =>
													setEditedSkills(
														e.target.value
															.split(",")
															.map((s) => s.trim())
															.filter(Boolean)
													)
												}
												className="mt-1 min-h-[60px]"
												placeholder="React.js, TypeScript, Node.js..."
											/>
											<div className="mt-2 flex flex-wrap gap-1">
												{editedSkills.slice(0, 10).map((skill, i) => (
													<span
														key={i}
														className={cn(
															"rounded-full px-2 py-0.5 text-xs",
															i < 4
																? "bg-primary/20 text-primary font-medium"
																: "bg-muted text-muted-foreground"
														)}
													>
														{skill}
													</span>
												))}
												{editedSkills.length > 10 && (
													<span className="text-xs text-muted-foreground">
														+{editedSkills.length - 10} more
													</span>
												)}
											</div>
										</div>

										{/* Work Experience */}
										<div className="mb-4">
											<Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
												Work Experience
											</Label>
											<div className="space-y-4">
												{editedExperience.map((exp, expIndex) => (
													<div
														key={expIndex}
														className="rounded border bg-muted/30 p-4"
													>
														<div className="grid grid-cols-2 gap-3 mb-3">
															<div>
																<Label className="text-xs">Company</Label>
																<Input
																	value={exp.company}
																	onChange={(e) => {
																		const updated = [...editedExperience];
																		updated[expIndex] = {
																			...exp,
																			company: e.target.value,
																		};
																		setEditedExperience(updated);
																	}}
																	className="mt-1"
																/>
															</div>
															<div>
																<Label className="text-xs">Title</Label>
																<Input
																	value={exp.title}
																	onChange={(e) => {
																		const updated = [...editedExperience];
																		updated[expIndex] = {
																			...exp,
																			title: e.target.value,
																		};
																		setEditedExperience(updated);
																	}}
																	className="mt-1"
																/>
															</div>
														</div>
														<div className="grid grid-cols-2 gap-3 mb-3">
															<div>
																<Label className="text-xs">Start Date</Label>
																<Input
																	value={exp.startDate}
																	onChange={(e) => {
																		const updated = [...editedExperience];
																		updated[expIndex] = {
																			...exp,
																			startDate: e.target.value,
																		};
																		setEditedExperience(updated);
																	}}
																	className="mt-1"
																	placeholder="2022-01"
																/>
															</div>
															<div>
																<Label className="text-xs">End Date</Label>
																<Input
																	value={exp.endDate || ""}
																	onChange={(e) => {
																		const updated = [...editedExperience];
																		updated[expIndex] = {
																			...exp,
																			endDate: e.target.value || undefined,
																		};
																		setEditedExperience(updated);
																	}}
																	className="mt-1"
																	placeholder="Present"
																/>
															</div>
														</div>
														<div>
															<Label className="text-xs">
																Highlights (one per line)
															</Label>
															<Textarea
																value={exp.highlights.join("\n")}
																onChange={(e) => {
																	const updated = [...editedExperience];
																	updated[expIndex] = {
																		...exp,
																		highlights: e.target.value
																			.split("\n")
																			.filter(Boolean),
																	};
																	setEditedExperience(updated);
																}}
																className="mt-1 min-h-[80px] text-sm"
																placeholder="• Led development of..."
															/>
														</div>
													</div>
												))}
											</div>
										</div>

										{/* Education */}
										<div className="mb-4">
											<Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
												Education
											</Label>
											<div className="space-y-4">
												{editedEducation.map((edu, eduIndex) => (
													<div
														key={eduIndex}
														className="rounded border bg-muted/30 p-4"
													>
														<div className="grid grid-cols-2 gap-3 mb-3">
															<div>
																<Label className="text-xs">Institution</Label>
																<Input
																	value={edu.institution}
																	onChange={(e) => {
																		const updated = [...editedEducation];
																		updated[eduIndex] = {
																			...edu,
																			institution: e.target.value,
																		};
																		setEditedEducation(updated);
																	}}
																	className="mt-1"
																/>
															</div>
															<div>
																<Label className="text-xs">Degree</Label>
																<Input
																	value={edu.degree}
																	onChange={(e) => {
																		const updated = [...editedEducation];
																		updated[eduIndex] = {
																			...edu,
																			degree: e.target.value,
																		};
																		setEditedEducation(updated);
																	}}
																	className="mt-1"
																/>
															</div>
														</div>
														<div className="grid grid-cols-2 gap-3">
															<div>
																<Label className="text-xs">
																	Field of Study
																</Label>
																<Input
																	value={edu.field}
																	onChange={(e) => {
																		const updated = [...editedEducation];
																		updated[eduIndex] = {
																			...edu,
																			field: e.target.value,
																		};
																		setEditedEducation(updated);
																	}}
																	className="mt-1"
																/>
															</div>
															<div>
																<Label className="text-xs">
																	Graduation Date
																</Label>
																<Input
																	value={edu.endDate || ""}
																	onChange={(e) => {
																		const updated = [...editedEducation];
																		updated[eduIndex] = {
																			...edu,
																			endDate: e.target.value || undefined,
																		};
																		setEditedEducation(updated);
																	}}
																	className="mt-1"
																	placeholder="2020"
																/>
															</div>
														</div>
													</div>
												))}
											</div>
										</div>

										{/* Projects */}
										{editedProjects.length > 0 && (
											<div className="mb-4">
												<Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
													Projects
												</Label>
												<div className="space-y-4">
													{editedProjects.map((proj, projIndex) => (
														<div
															key={projIndex}
															className="rounded border bg-muted/30 p-4"
														>
															<div className="mb-3">
																<Label className="text-xs">Project Name</Label>
																<Input
																	value={proj.name}
																	onChange={(e) => {
																		const updated = [...editedProjects];
																		updated[projIndex] = {
																			...proj,
																			name: e.target.value,
																		};
																		setEditedProjects(updated);
																	}}
																	className="mt-1"
																/>
															</div>
															<div className="mb-3">
																<Label className="text-xs">
																	Project Link (optional)
																</Label>
																<Input
																	value={proj.url || ""}
																	onChange={(e) => {
																		const updated = [...editedProjects];
																		updated[projIndex] = {
																			...proj,
																			url: e.target.value,
																		};
																		setEditedProjects(updated);
																	}}
																	className="mt-1"
																	placeholder="https://..."
																/>
															</div>
															<div>
																<Label className="text-xs">
																	Highlights (one per line)
																</Label>
																<Textarea
																	value={proj.highlights.join("\n")}
																	onChange={(e) => {
																		const updated = [...editedProjects];
																		updated[projIndex] = {
																			...proj,
																			highlights: e.target.value
																				.split("\n")
																				.filter(Boolean),
																		};
																		setEditedProjects(updated);
																	}}
																	className="mt-1 min-h-[60px] text-sm"
																/>
															</div>
														</div>
													))}
												</div>
											</div>
										)}
									</div>

									{/* ==================== COVER LETTER SECTION ==================== */}
									<div className="rounded-lg border-2 border-primary/20 bg-background/60 p-6">
										<div className="flex items-center justify-between mb-4">
											<h2 className="text-xl font-bold flex items-center gap-2">
												<FileText className="h-5 w-5 text-primary" />
												Cover Letter
											</h2>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleCopy("cover")}
											>
												{copied === "cover" ? (
													<CheckCircle2 className="h-4 w-4 text-green-500" />
												) : (
													<Copy className="h-4 w-4" />
												)}
											</Button>
										</div>
										<Textarea
											value={editedCoverLetter}
											onChange={(e) => setEditedCoverLetter(e.target.value)}
											className="min-h-[300px] text-sm"
											placeholder="Your cover letter..."
										/>
									</div>

									{/* Actions */}
									<div className="flex flex-wrap gap-3">
										<Button
											variant="outline"
											onClick={() => setStep("select-template")}
										>
											<ArrowLeft className="mr-2 h-4 w-4" />
											Try Different Template
										</Button>
										<Button variant="outline" onClick={handleGenerate}>
											<Wand2 className="mr-2 h-4 w-4" />
											Regenerate
										</Button>
										<Button onClick={() => setShowTrackModal(true)}>
											<Save className="mr-2 h-4 w-4" />
											Track Application
										</Button>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Full Preview Modal */}
			{showPreview && previewResume && (
				<ResumePreview
					resume={previewResume}
					templateId={previewTemplateId || selectedTemplateId}
					isOpen={showPreview}
					onClose={() => {
						setShowPreview(false);
						setPreviewTemplateId(null);
					}}
				/>
			)}

			{/* Track Application Modal */}
			<Dialog open={showTrackModal} onOpenChange={setShowTrackModal}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Building2 className="h-5 w-5 text-primary" />
							Track Application
						</DialogTitle>
						<DialogDescription>
							Save your resume and cover letter for {form.jobTitle} at{" "}
							{form.companyName}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						{error && (
							<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
								{error}
							</div>
						)}

						{/* Status */}
						<div className="space-y-2">
							<Label>Application Status</Label>
							<Select
								value={trackForm.status}
								onValueChange={(value: ApplicationStatus) =>
									setTrackForm({ ...trackForm, status: value })
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="saved">Saved (Not Applied Yet)</SelectItem>
									<SelectItem value="applied">Applied</SelectItem>
									<SelectItem value="interviewing">Interviewing</SelectItem>
									<SelectItem value="offered">Offered</SelectItem>
									<SelectItem value="rejected">Rejected</SelectItem>
									<SelectItem value="withdrawn">Withdrawn</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Applied Date */}
						{trackForm.status === "applied" && (
							<div className="space-y-2">
								<Label className="flex items-center gap-2">
									<Calendar className="h-4 w-4" />
									Applied Date
								</Label>
								<Input
									type="date"
									value={trackForm.appliedAt}
									onChange={(e) =>
										setTrackForm({ ...trackForm, appliedAt: e.target.value })
									}
								/>
							</div>
						)}

						{/* Job URL */}
						<div className="space-y-2">
							<Label className="flex items-center gap-2">
								<LinkIcon className="h-4 w-4" />
								Job Posting URL (optional)
							</Label>
							<Input
								placeholder="https://..."
								value={trackForm.jobUrl}
								onChange={(e) =>
									setTrackForm({ ...trackForm, jobUrl: e.target.value })
								}
							/>
						</div>

						{/* Salary Range */}
						<div className="space-y-2">
							<Label className="flex items-center gap-2">
								<DollarSign className="h-4 w-4" />
								Salary Range (optional)
							</Label>
							<Input
								placeholder="e.g., $120k - $150k"
								value={trackForm.salaryRange}
								onChange={(e) =>
									setTrackForm({ ...trackForm, salaryRange: e.target.value })
								}
							/>
						</div>

						{/* Follow-up Date */}
						<div className="space-y-2">
							<Label className="flex items-center gap-2">
								<Calendar className="h-4 w-4" />
								Follow-up Reminder (optional)
							</Label>
							<Input
								type="date"
								value={trackForm.followUpDate}
								onChange={(e) =>
									setTrackForm({ ...trackForm, followUpDate: e.target.value })
								}
							/>
						</div>

						{/* Notes */}
						<div className="space-y-2">
							<Label>Notes (optional)</Label>
							<Textarea
								placeholder="Any notes about this application..."
								value={trackForm.notes}
								onChange={(e) =>
									setTrackForm({ ...trackForm, notes: e.target.value })
								}
								rows={3}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowTrackModal(false)}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button onClick={handleSaveApplication} disabled={isSaving}>
							{isSaving ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<CheckCircle2 className="mr-2 h-4 w-4" />
									Save Application
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function groupSkillsFromArray(skills: string[]): JSONResume["skills"] {
	// Simple grouping - put all skills in one category
	return [
		{
			name: "Technical Skills",
			keywords: skills,
		},
	];
}

// Normalize freeform project text into per-line highlights
function normalizeHighlights(raw: string | string[]): string[] {
	if (Array.isArray(raw)) {
		raw = raw.join(" ");
	}

	if (!raw) return [];

	return raw
		.replace(/•/g, "\n")
		.split(/\r?\n/)
		.flatMap((line) =>
			line
				.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
				.map((s) => s.trim().replace(/^[•\-\s]+/, ""))
		)
		.map((s) => s.trim())
		.filter(Boolean);
}

// Clean up URLs that may contain spaces or be missing protocol
function sanitizeUrl(raw?: string): string | undefined {
	if (!raw) return undefined;
	const compact = raw.replace(/\s+/g, "");
	if (!compact) return undefined;
	if (!/^https?:\/\//i.test(compact) && compact.includes(".")) {
		return `https://${compact}`;
	}
	return compact;
}

// Try to pull a URL out of freeform text (e.g., "Link: https://example.com")
function extractUrlFromText(text?: string): string | undefined {
	if (!text) return undefined;
	const match = text.match(/https?:\/\/[^\s)]+/i);
	return match ? match[0] : undefined;
}
