"use client";

import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatSalary } from "@/lib/jobs/types";
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
	Copy,
	ArrowUp,
	ArrowDown,
	GripVertical,
	Trash2,
	RotateCcw,
	Calendar,
	DollarSign,
	Link as LinkIcon,
	Save,
	Zap,
	Settings,
	AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type JSONResume, type ResumeSection } from "@/lib/sampleResume";
import { TemplateGallery } from "@/components/TemplateGallery";
import { TypstPreview } from "@/components/TypstPreview";
import {
	DEFAULT_TYPST_COVER,
	DEFAULT_TYPST_RESUME,
	type TemplateInfo,
} from "@/lib/templateCatalog";
import { ProfileCompletionBanner } from "@/components/ProfileCompletionBanner";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type Quota = {
	used: number;
	limit: number;
	remaining: number;
	has_own_key: boolean;
};

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

const DEFAULT_SECTION_ORDER: ResumeSection[] = [
	"summary",
	"skills",
	"experience",
	"education",
	"projects",
];

const SECTION_LABELS: Record<ResumeSection, string> = {
	summary: "Summary",
	skills: "Skills",
	experience: "Experience",
	education: "Education",
	projects: "Projects",
};

export default function GeneratePage() {
	const router = useRouter();
	const [step, setStep] = useState<Step>("job-details");
	const [form, setForm] = useState({
		companyName: "",
		jobTitle: "",
		jobDescription: "",
		recruiterName: "",
		recruiterEmail: "",
	});
	const [contactEmail, setContactEmail] = useState("");
	const [canOverrideEmail, setCanOverrideEmail] = useState(false);
	const [profileEmail, setProfileEmail] = useState("");
	// Typst template id (templates/typst/<id>)
	const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TYPST_RESUME);
	const [catalog, setCatalog] = useState<TemplateInfo[]>([]);
	const [accent, setAccent] = useState<string>("");
	const [paper, setPaper] = useState<"a4" | "letter">("a4");
	const selectedInfo = catalog.find((t) => t.id === selectedTemplateId);

	// Template catalog (resume templates from templates/typst)
	useEffect(() => {
		let cancelled = false;
		fetch("/api/templates?kind=resume")
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (cancelled || !data?.templates?.length) return;
				const list = data.templates as TemplateInfo[];
				setCatalog(list);
				setSelectedTemplateId((prev) =>
					list.some((t) => t.id === prev) ? prev : list.find((t) => t.id === DEFAULT_TYPST_RESUME)?.id ?? list[0].id
				);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	// Reset accent/paper to the template defaults when switching templates
	useEffect(() => {
		if (!selectedInfo) return;
		setAccent(selectedInfo.accentDefault ?? "");
		setPaper(selectedInfo.paperDefault);
	}, [selectedInfo?.id]); // eslint-disable-line react-hooks/exhaustive-deps
	const [isGenerating, setIsGenerating] = useState(false);
	const [generatedContent, setGeneratedContent] =
		useState<GeneratedContent | null>(null);
	const [quota, setQuota] = useState<Quota | null>(null);
	const [loadingQuota, setLoadingQuota] = useState(true);

	// Load quota on mount
	useEffect(() => {
		const loadQuota = async () => {
			try {
				const supabase = getSupabaseBrowserClient();
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (user) {
					const { data } = await supabase.rpc("check_generation_quota", {
						p_user_id: user.id,
					});
					if (data) {
						setQuota(data);
					}
				}
			} catch (err) {
				console.error("Failed to load quota:", err);
			} finally {
				setLoadingQuota(false);
			}
		};
		loadQuota();
	}, []);

	// Load profile email + resume email allowance
	useEffect(() => {
		const loadProfileContactEmail = async () => {
			try {
				const supabase = getSupabaseBrowserClient();
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user) return;

				const { data: profile } = await supabase
					.from("profiles")
					.select("email, resume_email, can_change_email")
					.eq("id", user.id)
					.single();

				const baseEmail = profile?.email || "";
				const canChange = !!profile?.can_change_email;
				const resumeEmail = profile?.resume_email || "";

				setProfileEmail(baseEmail);
				setCanOverrideEmail(canChange);
				setContactEmail(canChange && resumeEmail ? resumeEmail : baseEmail);
			} catch (err) {
				console.error("Failed to load profile email", err);
			}
		};

		void loadProfileContactEmail();
	}, []);
	const [error, setError] = useState<string | null>(null);
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

	// Job Inbox -> "Generate documents" (/generate?job=<job_matches.id>): prefill
	// the job details; after saving, the new application is linked to the match.
	const [jobMatchId, setJobMatchId] = useState<string | null>(null);
	const [jobCompanyId, setJobCompanyId] = useState<string | null>(null);
	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("job");
		if (!id) return;
		fetch(`/api/jobs/${id}`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				const job = data?.job;
				if (!job) return;
				setJobMatchId(job.id);
				setJobCompanyId(job.company_id ?? null);
				setForm((f) => ({
					...f,
					companyName: job.company || f.companyName,
					jobTitle: job.title || f.jobTitle,
					jobDescription: job.description || f.jobDescription,
				}));
				setTrackForm((t) => ({
					...t,
					jobUrl: job.url || t.jobUrl,
					salaryRange: formatSalary(job) || t.salaryRange,
				}));
			})
			.catch(() => {});
	}, []);

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

	// Section arrangement state
	const [sectionOrder, setSectionOrder] =
		useState<ResumeSection[]>(DEFAULT_SECTION_ORDER);
	const [hiddenSections, setHiddenSections] = useState<ResumeSection[]>([]);
	const [draggingSection, setDraggingSection] =
		useState<ResumeSection | null>(null);

	// Editable content state - Cover Letter
	const [editedCoverLetter, setEditedCoverLetter] = useState("");


	const canProceed =
		form.companyName.trim().length > 1 &&
		form.jobTitle.trim().length > 1 &&
		form.jobDescription.trim().length > 20;

	// Check if generation is blocked by quota
	const isQuotaBlocked = quota && !quota.has_own_key && quota.remaining === 0;
	const visibleSections = useMemo(
		() =>
			sectionOrder.filter((section) => !hiddenSections.includes(section)),
		[sectionOrder, hiddenSections]
	);

	const handleGenerate = async () => {
		// Double-check quota before generating
		if (isQuotaBlocked) {
			setError(
				"Free generation limit reached. Please add your own API key in Settings to continue."
			);
			return;
		}

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
					recruiterEmail: form.recruiterEmail.trim() || undefined,
					templateId: selectedTemplateId,
					generateCoverLetter: true,
					contactEmail:
						canOverrideEmail && contactEmail.trim().length > 0
							? contactEmail.trim()
							: undefined,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				// Check if it's a quota exceeded error
				if (data.quotaExceeded) {
					setQuota((prev) => (prev ? { ...prev, remaining: 0 } : null));
				}
				throw new Error(data.error || "Failed to generate content");
			}

			// Update quota after successful generation
			if (quota && !quota.has_own_key) {
				setQuota((prev) =>
					prev
						? {
								...prev,
								used: prev.used + 1,
								remaining: Math.max(0, prev.remaining - 1),
						  }
						: null
				);
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
			setSectionOrder(
				deriveSectionOrderFromContent({
					summary: data.resume?.summary,
					skills: data.resume?.skillsOrdered || data.profile?.skills,
					experience: experienceWithHighlights,
					education: data.profile?.education,
					projects: projectsFromSections,
				})
			);
			setHiddenSections([]);

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
		const isHidden = (section: ResumeSection) =>
			hiddenSections.includes(section);

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

		const visibleOrder = sectionOrder.filter((section) => !isHidden(section));
		const visibleSkills = isHidden("skills")
			? []
			: groupSkillsFromArray(editedSkills);
		const visibleWork = isHidden("experience")
			? []
			: editedExperience.map((exp) => ({
					name: exp.company,
					position: exp.title,
					startDate: exp.startDate,
					endDate: exp.endDate,
					highlights: exp.highlights,
			  }));
		const visibleEducation = isHidden("education")
			? []
			: editedEducation.map((edu) => ({
					institution: edu.institution,
					area: edu.field,
					studyType: edu.degree,
					startDate: "",
					endDate: edu.endDate,
			  }));
		const visibleProjects =
			!isHidden("projects") && projects.length > 0 ? projects : undefined;

		return {
			basics: {
				name: profile.name,
				label: editedLabel,
				image: profile.image,
				email: contactEmail || profile.email,
				phone: profile.phone,
				url: profile.website,
				summary: isHidden("summary") ? "" : editedSummary,
				location: {
					city: profile.location || "",
					countryCode: "US",
				},
				profiles: profile.linkedin
					? [{ network: "LinkedIn", username: "", url: profile.linkedin }]
					: [],
			},
			work: visibleWork,
			education: visibleEducation,
			skills: visibleSkills,
			projects: visibleProjects,
			meta: {
				sectionOrder: visibleOrder,
				hiddenSections,
			},
		};
	}, [
		generatedContent,
		editedLabel,
		editedSummary,
		editedSkills,
		editedExperience,
		editedEducation,
		editedProjects,
		sectionOrder,
		hiddenSections,
		contactEmail,
	]);

	// Typst: accent / paper travel in content_json.meta (read by the templates)
	const typstResume = useMemo(() => {
		if (!finalResume) return null;
		return {
			...finalResume,
			meta: {
				...(finalResume.meta || {}),
				...(accent ? { accent } : {}),
				paper,
			},
		};
	}, [finalResume, accent, paper]);

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

	// Full-size sample of a template (its thumbnail)
	const handleTemplatePreview = (id: string) => {
		const info = catalog.find((t) => t.id === id);
		if (info) window.open(info.thumbnailUrl, "_blank");
	};

	// PDFs are rendered by the worker once the application is saved.
	const handleDownloadPDF = () => {
		if (!finalResume) return;
		setShowTrackModal(true);
	};

	const hideSection = (section: ResumeSection) => {
		setHiddenSections((prev) =>
			prev.includes(section) ? prev : [...prev, section]
		);
	};

	const restoreSection = (section: ResumeSection) => {
		setHiddenSections((prev) => prev.filter((s) => s !== section));
		if (!sectionOrder.includes(section)) {
			setSectionOrder((prev) => [...prev, section]);
		}
	};

	const resetSections = () => {
		setHiddenSections([]);
		setSectionOrder(
			deriveSectionOrderFromContent({
				summary: editedSummary,
				skills: editedSkills,
				experience: editedExperience,
				education: editedEducation,
				projects: editedProjects,
			})
		);
	};

	const moveSection = (section: ResumeSection, direction: -1 | 1) => {
		setSectionOrder((prev) => {
			const hiddenSet = new Set(hiddenSections);
			const visible = prev.filter((s) => !hiddenSet.has(s));
			const index = visible.indexOf(section);
			const newIndex = index + direction;
			if (index === -1 || newIndex < 0 || newIndex >= visible.length) {
				return prev;
			}

			const updatedVisible = [...visible];
			const [moved] = updatedVisible.splice(index, 1);
			updatedVisible.splice(newIndex, 0, moved);

			const hiddenOnly = prev.filter((s) => hiddenSet.has(s));
			return [...updatedVisible, ...hiddenOnly];
		});
	};

	const reorderSections = (
		dragged: ResumeSection,
		target: ResumeSection
	) => {
		setSectionOrder((prev) => {
			const hiddenSet = new Set(hiddenSections);
			const visible = prev.filter((s) => !hiddenSet.has(s));
			const hidden = prev.filter((s) => hiddenSet.has(s));
			const fromIndex = visible.indexOf(dragged);
			const toIndex = visible.indexOf(target);

			if (fromIndex === -1 || toIndex === -1) return prev;

			const updatedVisible = [...visible];
			const [moved] = updatedVisible.splice(fromIndex, 1);
			updatedVisible.splice(toIndex, 0, moved);

			return [...updatedVisible, ...hidden];
		});
	};

	const handleDragStart = (section: ResumeSection) => {
		setDraggingSection(section);
	};

	const handleDragOver = (event: DragEvent<HTMLElement>) => {
		event.preventDefault();
	};

	const handleDrop = (section: ResumeSection) => {
		if (draggingSection && draggingSection !== section) {
			reorderSections(draggingSection, section);
		}
		setDraggingSection(null);
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
					existingCompanyId: jobCompanyId,
					name: form.companyName.trim(),
					status: trackForm.status,
					jobTitle: form.jobTitle.trim(),
					jobDescription: form.jobDescription.trim(),
					jobUrl: trackForm.jobUrl.trim() || null,
					recruiterName: form.recruiterName.trim() || null,
					recruiterEmail: form.recruiterEmail.trim() || null,
					salaryRange: trackForm.salaryRange.trim() || null,
					notes: trackForm.notes.trim() || null,
					appliedAt:
						trackForm.status === "applied" ? trackForm.appliedAt : null,
					followUpDate: trackForm.followUpDate || null,
					resume: typstResume,
					coverLetter: editedCoverLetter,
					templateId: selectedTemplateId,
					coverLetterTemplateId: selectedInfo?.pairsWith || DEFAULT_TYPST_COVER,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to save application");
			}

			if (jobMatchId && data.company?.id) {
				await fetch(`/api/jobs/${jobMatchId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ company_id: data.company.id }),
				}).catch(() => {});
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

				{/* Quota Banner */}
				{!loadingQuota && quota && !quota.has_own_key && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="container mx-auto max-w-4xl px-4 pt-4"
					>
						<Card
							className={cn(
								"border-border/50 backdrop-blur",
								quota.remaining === 0
									? "border-amber-500/50 bg-amber-500/5"
									: "bg-card/80"
							)}
						>
							<CardContent className="flex items-center justify-between gap-4 py-3 px-4">
								<div className="flex items-center gap-3">
									<div
										className={cn(
											"flex h-9 w-9 items-center justify-center rounded-lg",
											quota.remaining === 0
												? "bg-amber-500/10"
												: "bg-purple-500/10"
										)}
									>
										<Zap
											className={cn(
												"h-4 w-4",
												quota.remaining === 0
													? "text-amber-500"
													: "text-purple-500"
											)}
										/>
									</div>
									<div>
										<p className="text-sm font-medium">
											{quota.remaining === 0 ? (
												<span className="text-amber-600 dark:text-amber-400">
													Free generation limit reached
												</span>
											) : (
												<>
													<span className="text-purple-600 dark:text-purple-400">
														{quota.remaining}
													</span>
													<span className="text-muted-foreground"> of </span>
													<span className="text-purple-600 dark:text-purple-400">
														{quota.limit}
													</span>
													<span className="text-muted-foreground">
														{" "}
														free AI generations remaining
													</span>
												</>
											)}
										</p>
										<p className="text-xs text-muted-foreground">
											{quota.remaining === 0
												? "Add your own API key to continue generating resumes"
												: "Add your API key for unlimited generations"}
										</p>
									</div>
								</div>
								<Button
									variant={quota.remaining === 0 ? "default" : "outline"}
									size="sm"
									asChild
								>
									<Link href="/settings">
										<Settings className="mr-2 h-4 w-4" />
										{quota.remaining === 0 ? "Add API Key" : "Settings"}
									</Link>
								</Button>
							</CardContent>
						</Card>
					</motion.div>
				)}

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
											Recruiter/Hiring Manager Contact (optional)
										</Label>
										<div className="grid gap-3 md:grid-cols-2">
											<Input
												id="recruiterName"
												placeholder="Name (e.g., Jane Doe)"
												value={form.recruiterName}
												onChange={(e) =>
													setForm({ ...form, recruiterName: e.target.value })
												}
											/>
											<Input
												id="recruiterEmail"
												type="email"
												placeholder="Email (optional)"
												value={form.recruiterEmail}
												onChange={(e) =>
													setForm({ ...form, recruiterEmail: e.target.value })
												}
											/>
										</div>
										<p className="text-xs text-muted-foreground">
											Used to personalize the cover letter greeting and save recruiter details.
										</p>
									</div>

									<div className="space-y-2">
										<Label htmlFor="contactEmail">
											Resume Contact Email
										</Label>
										<Input
											id="contactEmail"
											type="email"
											placeholder={
												canOverrideEmail
													? "e.g., resume+jobs@yourdomain.com"
													: profileEmail || "Your account email"
											}
											value={contactEmail}
											disabled={!canOverrideEmail}
											onChange={(e) => setContactEmail(e.target.value)}
										/>
										<p className="text-xs text-muted-foreground">
											This email will appear on the generated resume.{" "}
											{canOverrideEmail
												? "It won't change your account email."
												: "Admin has locked email changes; using your account email."}
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
										templates={catalog.filter((t) => t.kind === "resume")}
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
										<div className="flex items-center gap-3">
											{isQuotaBlocked && (
												<span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
													<AlertTriangle className="h-4 w-4" />
													Quota exceeded
												</span>
											)}
											<Button
												onClick={handleGenerate}
												disabled={isQuotaBlocked ?? false}
											>
												<Wand2 className="mr-2 h-4 w-4" />
												Generate with AI
											</Button>
										</div>
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
							<div
								className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
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
											<Button onClick={handleDownloadPDF}>
												<Download className="mr-2 h-4 w-4" />
												Save & render PDF
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

										{visibleSections.length > 0 && (
											<div className="mb-6 rounded-lg border bg-muted/30 p-4">
												<div className="mb-3 flex items-start justify-between gap-3">
													<div>
														<p className="text-sm font-semibold">
															Arrange sections
														</p>
														<p className="text-xs text-muted-foreground">
															Drag or use arrows to reorder. Delete hides a
															section before downloading.
														</p>
													</div>
													<div className="flex items-center gap-2">
														<Button
															variant="ghost"
															size="sm"
															onClick={resetSections}
														>
															<RotateCcw className="mr-2 h-4 w-4" />
															Reset
														</Button>
													</div>
												</div>
												<div className="space-y-2">
													{visibleSections.map((section, index) => (
														<div
															key={section}
															className={cn(
																"flex items-center gap-3 rounded border bg-background px-3 py-2 text-sm shadow-sm",
																draggingSection === section
																	? "ring-1 ring-primary"
																	: ""
															)}
															draggable
															onDragStart={() => handleDragStart(section)}
															onDragOver={handleDragOver}
															onDrop={() => handleDrop(section)}
															onDragEnd={() => setDraggingSection(null)}
														>
															<GripVertical className="h-4 w-4 text-muted-foreground" />
															<span className="font-medium">
																{SECTION_LABELS[section]}
															</span>
															<div className="ml-auto flex items-center gap-1">
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => moveSection(section, -1)}
																	disabled={index === 0}
																	aria-label="Move up"
																>
																	<ArrowUp className="h-4 w-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => moveSection(section, 1)}
																	disabled={index === visibleSections.length - 1}
																	aria-label="Move down"
																>
																	<ArrowDown className="h-4 w-4" />
																</Button>
																<Button
																	variant="ghost"
																	size="icon"
																	onClick={() => hideSection(section)}
																	aria-label="Hide section"
																>
																	<Trash2 className="h-4 w-4 text-destructive" />
																</Button>
															</div>
														</div>
													))}
												</div>
												{hiddenSections.length > 0 && (
													<div className="mt-4 border-t pt-3">
														<p className="mb-2 text-xs text-muted-foreground">
															Hidden sections (won&apos;t appear in the
															downloaded PDF)
														</p>
														<div className="flex flex-wrap gap-2">
															{hiddenSections.map((section) => (
																<Button
																	key={section}
																	variant="outline"
																	size="sm"
																	onClick={() => restoreSection(section)}
																>
																	<RotateCcw className="mr-2 h-4 w-4" />
																	{SECTION_LABELS[section]}
																</Button>
															))}
														</div>
													</div>
												)}
											</div>
										)}

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
										{!hiddenSections.includes("summary") && (
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
										)}

										{/* Skills */}
										{!hiddenSections.includes("skills") && (
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
										)}

										{/* Work Experience */}
										{!hiddenSections.includes("experience") &&
											editedExperience.length > 0 && (
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
																<div className="mb-2 flex items-center justify-between">
																	<span className="text-xs text-muted-foreground">
																		Role {expIndex + 1}
																	</span>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			setEditedExperience((prev) =>
																				prev.filter((_, idx) => idx !== expIndex)
																			)
																		}
																	>
																		<Trash2 className="mr-2 h-4 w-4" />
																		Delete
																	</Button>
																</div>
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
																placeholder="Led development of..."
															/>
														</div>
													</div>
												))}
											</div>
										</div>
									)}

										{/* Education */}
										{!hiddenSections.includes("education") &&
											editedEducation.length > 0 && (
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
																<div className="mb-2 flex items-center justify-between">
																	<span className="text-xs text-muted-foreground">
																		Education {eduIndex + 1}
																	</span>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			setEditedEducation((prev) =>
																				prev.filter((_, idx) => idx !== eduIndex)
																			)
																		}
																	>
																		<Trash2 className="mr-2 h-4 w-4" />
																		Delete
																	</Button>
																</div>
																<div className="grid grid-cols-2 gap-3 mb-3">
																	<div>
																		<Label className="text-xs">
																			Institution
																		</Label>
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
											)}

										{/* Projects */}
										{!hiddenSections.includes("projects") &&
											editedProjects.length > 0 && (
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
															<div className="mb-2 flex items-center justify-between">
																<span className="text-xs text-muted-foreground">
																	Project {projIndex + 1}
																</span>
																<Button
																	variant="ghost"
																	size="sm"
																	onClick={() =>
																		setEditedProjects((prev) =>
																			prev.filter((_, idx) => idx !== projIndex)
																		)
																	}
																>
																	<Trash2 className="mr-2 h-4 w-4" />
																	Delete
																</Button>
															</div>
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
							{typstResume && (
								<aside className="space-y-3 lg:sticky lg:top-4">
									<Card className="border-border/50 bg-card/80 backdrop-blur">
										<CardHeader className="pb-3">
											<CardTitle className="text-base">Live preview</CardTitle>
											<CardDescription>
												{selectedInfo?.name ?? selectedTemplateId}. The PDF is
												rendered in the background when you save.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-3">
											<div className="flex flex-wrap items-end gap-3">
												<div className="space-y-1">
													<Label className="text-xs">Template</Label>
													<Select
														value={selectedTemplateId}
														onValueChange={setSelectedTemplateId}
													>
														<SelectTrigger className="h-8 w-44 text-xs">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{catalog
																.filter((t) => t.kind === "resume")
																.map((t) => (
																	<SelectItem key={t.id} value={t.id}>
																		{t.name}
																	</SelectItem>
																))}
														</SelectContent>
													</Select>
												</div>
												{selectedInfo?.accentCustomizable && (
													<div className="space-y-1">
														<Label className="text-xs">Accent</Label>
														<input
															type="color"
															value={accent || selectedInfo.accentDefault || "#1f4e79"}
															onChange={(e) => setAccent(e.target.value)}
															className="h-8 w-12 cursor-pointer rounded border bg-transparent"
															aria-label="Accent colour"
														/>
													</div>
												)}
												<div className="space-y-1">
													<Label className="text-xs">Paper</Label>
													<Select
														value={paper}
														onValueChange={(v) => setPaper(v as "a4" | "letter")}
													>
														<SelectTrigger className="h-8 w-24 text-xs">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="a4">A4</SelectItem>
															<SelectItem value="letter">Letter</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>
											<TypstPreview
												templateId={selectedTemplateId}
												data={typstResume}
												accent={accent || null}
												paper={paper}
											/>
										</CardContent>
									</Card>
								</aside>
							)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

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

function deriveSectionOrderFromContent(content: {
	summary?: string;
	skills?: string[];
	experience?: unknown[];
	education?: unknown[];
	projects?: unknown[];
}): ResumeSection[] {
	const desiredOrder = DEFAULT_SECTION_ORDER;
	const includedSections = desiredOrder.filter((section) => {
		switch (section) {
			case "summary":
				return Boolean(content.summary && content.summary.trim().length > 0);
			case "skills":
				return Boolean(content.skills && content.skills.length > 0);
			case "experience":
				return Boolean(content.experience && content.experience.length > 0);
			case "education":
				return Boolean(content.education && content.education.length > 0);
			case "projects":
				return Boolean(content.projects && content.projects.length > 0);
			default:
				return false;
		}
	});

	return includedSections.length > 0 ? includedSections : [...desiredOrder];
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
