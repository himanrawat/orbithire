"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sampleResume, type JSONResume } from "@/lib/sampleResume";
import { TemplateGallery } from "@/components/TemplateGallery";
import { ResumePreview, type ResumeTemplate } from "@/components/ResumePreview";

type Step = "job-details" | "select-template" | "generating" | "preview";

interface GeneratedContent {
	resume: {
		label: string;
		summary: string;
		workHighlights: Record<string, string[]>;
		skillsOrdered: string[];
	};
	coverLetter: string;
	profile: {
		name: string;
		email: string;
		phone: string;
		location: string;
		linkedin?: string;
		website?: string;
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
	};
}

// Template definitions - using working themes only
const templates: ResumeTemplate[] = [
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
		style: "Professional",
		description: "Detailed, professional layout with comprehensive sections",
		tags: ["Corporate", "Detailed", "Executive"],
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
	const [step, setStep] = useState<Step>("job-details");
	const [form, setForm] = useState({
		companyName: "",
		jobTitle: "",
		jobDescription: "",
		recruiterName: "",
	});
	const [selectedTemplateId, setSelectedTemplateId] = useState("even");
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
			setStep("preview");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setStep("select-template");
		} finally {
			setIsGenerating(false);
		}
	};

	// Build the full JSONResume from generated content
	const finalResume = useMemo((): JSONResume | null => {
		if (!generatedContent) return null;

		const { resume, profile } = generatedContent;

		return {
			basics: {
				name: profile.name,
				label: resume.label,
				email: profile.email,
				phone: profile.phone,
				url: profile.website,
				summary: resume.summary,
				location: {
					city: profile.location || "",
					countryCode: "US",
				},
				profiles: profile.linkedin
					? [{ network: "LinkedIn", username: "", url: profile.linkedin }]
					: [],
			},
			work: profile.experience.map((exp) => ({
				name: exp.company,
				position: exp.title,
				startDate: exp.startDate,
				endDate: exp.endDate,
				highlights: resume.workHighlights[exp.company] || exp.highlights,
			})),
			education: profile.education.map((edu) => ({
				institution: edu.institution,
				area: edu.field,
				studyType: edu.degree,
				startDate: "",
				endDate: edu.endDate,
			})),
			skills: groupSkillsFromArray(resume.skillsOrdered || profile.skills),
		};
	}, [generatedContent]);

	const handleCopy = (type: "resume" | "cover") => {
		if (!generatedContent) return;

		if (type === "cover") {
			navigator.clipboard.writeText(generatedContent.coverLetter);
		} else {
			// Copy resume as text summary
			const text = `${generatedContent.profile.name}\n${generatedContent.resume.label}\n\n${generatedContent.resume.summary}`;
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

	return (
		<div className="min-h-screen">
			<GridBackground />

			<div className="relative">
				{/* Progress indicator */}
				<div className="mb-6 flex items-center justify-center gap-2">
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
											<Button variant="outline" onClick={handleOpenPreview}>
												<Eye className="mr-2 h-4 w-4" />
												Full Preview
											</Button>
											<Button>
												<Download className="mr-2 h-4 w-4" />
												Download PDF
											</Button>
										</div>
									</div>
								</CardHeader>
								<CardContent className="space-y-6">
									{/* Resume Summary */}
									<div className="rounded-lg border bg-background/60 p-6">
										<div className="flex items-center justify-between">
											<h3 className="font-semibold">Professional Summary</h3>
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
										<p className="mt-2 text-sm text-muted-foreground">
											<span className="font-medium text-foreground">
												{generatedContent.resume.label}
											</span>
										</p>
										<p className="mt-3 text-sm">
											{generatedContent.resume.summary}
										</p>
									</div>

									{/* Optimized Skills */}
									<div className="rounded-lg border bg-background/60 p-6">
										<h3 className="font-semibold">
											Skills (Reordered for Relevance)
										</h3>
										<div className="mt-3 flex flex-wrap gap-2">
											{generatedContent.resume.skillsOrdered
												.slice(0, 12)
												.map((skill, i) => (
													<span
														key={skill}
														className={cn(
															"rounded-full px-3 py-1 text-sm",
															i < 4
																? "bg-primary/20 text-primary font-medium"
																: "bg-muted text-muted-foreground"
														)}
													>
														{skill}
													</span>
												))}
										</div>
									</div>

									{/* Cover Letter */}
									<div className="rounded-lg border bg-background/60 p-6">
										<div className="flex items-center justify-between">
											<h3 className="font-semibold">Cover Letter</h3>
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
										<div className="mt-3 whitespace-pre-wrap text-sm">
											{generatedContent.coverLetter}
										</div>
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
										<Button asChild>
											<Link href="/companies">
												<Building2 className="mr-2 h-4 w-4" />
												Save to Company
											</Link>
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
