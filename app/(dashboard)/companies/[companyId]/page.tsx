"use client";

import { useEffect, useMemo, useState } from "react";
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
import { cn, slugify } from "@/lib/utils";
import {
	Building2,
	ChevronLeft,
	Plus,
	Save,
	Sparkles,
	ClipboardList,
	FileText,
	Wand2,
	History,
	FolderOpen,
	LinkIcon,
	Globe2,
	User,
	CheckCircle2,
	XCircle,
	ListChecks,
	Layers,
} from "lucide-react";
import {
	companyDirectory,
	findCompanyBySlug,
	keywordLibrary,
	templateOptions,
	type AuditLogEntry,
	type CompanyFolder,
	type DocumentVersion,
	type JobApplication,
	type KeywordSet,
	type TemplateOption,
} from "../data";

type PendingGeneration = {
	companyName: string;
	slug: string;
	jobTitle: string;
	jobDescription: string;
	recruiterName?: string;
	recruiterEmail?: string;
	templateId: string;
	createdAt: string;
};

const pendingKey = "pendingGeneration";

type JobFormState = {
	companyName: string;
	jobTitle: string;
	jobDescription: string;
	jobLink: string;
	employmentType: string;
	workMode: string;
	recruiter: JobApplication["recruiter"];
	extraFields: JobApplication["extraFields"];
	selectedTemplateId: string;
	notes: string;
};

const emptyKeywords: KeywordSet = {
	skills: [],
	tools: [],
	responsibilities: [],
	domains: [],
};

const mockProfile = {
	name: "Avery Brooks",
	headline: "Product-focused software engineer",
	location: "Remote-first",
	summary:
		"6+ years building data-rich products with React, TypeScript, and GraphQL.",
	topSkills: ["React", "TypeScript", "GraphQL", "Data storytelling"],
};

function createId() {
	if (typeof crypto !== "undefined" && crypto.randomUUID)
		return crypto.randomUUID();
	return Math.random().toString(36).slice(2);
}

function toTitleCase(value: string) {
	return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveNameFromSlug(slug: string) {
	const spaced = slug.replace(/-/g, " ").trim();
	return spaced ? toTitleCase(spaced) : "New Company";
}

function dedupe(list: string[]) {
	return Array.from(new Set(list));
}

function extractKeywords(description: string): KeywordSet {
	if (!description.trim()) return emptyKeywords;
	const lower = description.toLowerCase();
	const pickMatches = (source: string[]) =>
		source.filter((item) => lower.includes(item.toLowerCase()));

	const inferredResponsibilities = description
		.split(/\n|\. /)
		.map((line) => line.replace(/^[-*]\s*/, "").trim())
		.filter((line) => line.length > 12)
		.slice(0, 4);

	const inferredSkills = description
		.split(/[\s,]/)
		.filter((word) => word.length > 4)
		.filter((word) => word[0] && word[0] === word[0].toUpperCase())
		.slice(0, 6);

	return {
		skills: dedupe([...pickMatches(keywordLibrary.skills), ...inferredSkills]),
		tools: dedupe(pickMatches(keywordLibrary.tools)),
		responsibilities: dedupe([
			...pickMatches(keywordLibrary.responsibilities),
			...inferredResponsibilities,
		]),
		domains: dedupe(pickMatches(keywordLibrary.domains)),
	};
}

function jobSlug(title: string, fallback: string) {
	const base = title?.trim() ? title : fallback;
	return slugify(base || "role");
}

function buildPaths(
	companySlug: string,
	jobTitle: string,
	type: DocumentVersion["type"],
	version: number
) {
	const base = `companies/${companySlug}/${jobSlug(jobTitle, `${type}`)}`;
	const prefix = type === "resume" ? "resume" : "cover-letter";
	return {
		pdf: `${base}/${prefix}-v${version}.pdf`,
		docx: `${base}/${prefix}-v${version}.docx`,
	};
}

function versionNumber(job: JobApplication, type: DocumentVersion["type"]) {
	return (
		job.versions
			.filter((version) => version.type === type)
			.reduce((max, version) => Math.max(max, version.version), 0) + 1
	);
}

function generateResumeDraft(
	job: JobApplication,
	company: CompanyFolder,
	template: TemplateOption,
	keywords: KeywordSet
) {
	const keywordLine = dedupe([
		...keywords.skills,
		...keywords.tools,
		...keywords.domains,
	])
		.slice(0, 8)
		.join(", ");

	return [
		`${template.name} (${template.locale}) template for ${company.name}`,
		`${mockProfile.name} - ${mockProfile.headline} (${mockProfile.location})`,
		`Role focus: ${job.title || "Target role"}`,
		`Top keywords: ${keywordLine || "Pending extraction"}`,
		"Impact bullets:",
		"- Led cross-functional delivery with design and backend partners.",
		"- Quantified wins with adoption, performance, and accessibility metrics.",
		`- Matched responsibilities: ${
			(keywords.responsibilities || []).slice(0, 3).join("; ") ||
			"Align roadmap, own execution, communicate status."
		}`,
	].join("\n");
}

function generateCoverLetterDraft(
	job: JobApplication,
	company: CompanyFolder,
	keywords: KeywordSet
) {
	const keywordLine = dedupe([
		...keywords.skills,
		...keywords.tools,
		...keywords.domains,
	])
		.slice(0, 5)
		.join(", ");
	return [
		`Dear ${job.recruiter.name || "team"},`,
		`I am excited about the ${job.title || "role"} at ${company.name}.`,
		`I have shipped products that mirror your needs: ${
			keywordLine || "tailored impact pending keywords"
		}.`,
		`Recent work: ${mockProfile.summary}`,
		"Looking forward to sharing more in conversation.",
		"",
		`Thanks,\n${mockProfile.name}`,
	].join("\n");
}

function createInitialJobForm(company: CompanyFolder, job?: JobApplication): JobFormState {
	return {
		companyName: company.name,
		jobTitle: job?.title || "",
		jobDescription: job?.description || "",
		jobLink: job?.link || "",
		employmentType: job?.employmentType || "",
		workMode: job?.workMode || "Remote",
		recruiter: job?.recruiter || {},
		extraFields: job?.extraFields || [],
		selectedTemplateId: job?.selectedTemplateId || templateOptions[0].id,
		notes: job?.notes || "",
	};
}

function hydrateCompany(slug: string) {
	const existing = findCompanyBySlug(slug);
	if (existing) {
		return JSON.parse(JSON.stringify(existing)) as CompanyFolder;
	}

	const now = new Date().toISOString();
	const derivedName = deriveNameFromSlug(slug);
	const fallback: CompanyFolder = {
		id: slug,
		slug,
		name: derivedName,
		status: "saved",
		createdAt: now.slice(0, 10),
		lastActivity: now.slice(0, 10),
		jobs: [],
		auditLog: [
			{
				id: createId(),
				action: `Auto-created company folder for ${derivedName}`,
				timestamp: now,
				actor: "System",
			},
		],
	};
	return fallback;
}

export default function CompanyDetailPage({
	params,
}: {
	params: { companyId: string };
}) {
	const router = useRouter();
	const slug = decodeURIComponent(params.companyId);
	const bootstrappedCompany = useMemo(() => hydrateCompany(slug), [slug]);
	const [company, setCompany] = useState<CompanyFolder>(bootstrappedCompany);
	const [selectedJobId, setSelectedJobId] = useState<string>(
		bootstrappedCompany.jobs[0]?.id || ""
	);
	const [jobForm, setJobForm] = useState<JobFormState>(() =>
		createInitialJobForm(bootstrappedCompany, bootstrappedCompany.jobs[0])
	);
	const [resumeDraft, setResumeDraft] = useState(
		bootstrappedCompany.jobs[0]?.resumeDraft || ""
	);
	const [coverLetterDraft, setCoverLetterDraft] = useState(
		bootstrappedCompany.jobs[0]?.coverLetterDraft || ""
	);
	const [savingJob, setSavingJob] = useState(false);
	const [generating, setGenerating] = useState(false);
	const [savingVersion, setSavingVersion] = useState(false);
	const [nameError, setNameError] = useState("");

	const currentJob = company.jobs.find((job) => job.id === selectedJobId);
	const keywords = currentJob
		? currentJob.keywords
		: extractKeywords(jobForm.jobDescription);

	useEffect(() => {
		if (!currentJob) return;
		setJobForm(createInitialJobForm(company, currentJob));
		setResumeDraft(currentJob.resumeDraft || "");
		setCoverLetterDraft(currentJob.coverLetterDraft || "");
	}, [currentJob?.id]);

	const stats = useMemo(() => {
		const documents = company.jobs.flatMap((job) => job.versions);
		const resumes = documents.filter((doc) => doc.type === "resume").length;
		const coverLetters = documents.filter(
			(doc) => doc.type === "cover_letter"
		).length;
		return {
			jobCount: company.jobs.length,
			resumes,
			coverLetters,
			lastActivity: company.lastActivity,
		};
	}, [company]);

	const addAuditLog = (
		entry: Omit<AuditLogEntry, "id" | "timestamp" | "actor">
	) => {
		const now = new Date().toISOString();
		setCompany((prev) => ({
			...prev,
			auditLog: [
				{
					id: createId(),
					actor: "You",
					timestamp: now,
					...entry,
				},
				...prev.auditLog,
			].slice(0, 12),
			lastActivity: now.slice(0, 10),
		}));
	};

	useEffect(() => {
		if (typeof window === "undefined") return;
		const raw = localStorage.getItem(pendingKey);
		if (!raw) return;

		let pending: PendingGeneration | null = null;
		try {
			pending = JSON.parse(raw);
		} catch {
			return;
		}

		if (!pending || pending.slug !== slug) return;
		localStorage.removeItem(pendingKey);

		const detectedKeywords = extractKeywords(pending.jobDescription || "");
		const template =
			templateOptions.find((option) => option.id === pending.templateId) ||
			templateOptions[0];

		let nextJob: JobApplication = {
			id: createId(),
			title: pending.jobTitle || "Untitled role",
			description: pending.jobDescription,
			link: "",
			employmentType: "",
			workMode: "Remote",
			recruiter: {
				name: pending.recruiterName,
				email: pending.recruiterEmail,
			},
			extraFields: [],
			keywords: detectedKeywords,
			selectedTemplateId: template.id,
			resumeDraft: "",
			coverLetterDraft: "",
			versions: [],
		};

		const now = new Date().toISOString();

		setCompany((prev) => {
			const existing = prev.jobs.find(
				(job) =>
					job.title.toLowerCase() === (pending?.jobTitle || "").toLowerCase()
			);

			const baseJob = existing
				? {
						...existing,
						title: pending?.jobTitle || existing.title,
						description: pending?.jobDescription || existing.description,
						recruiter: { ...existing.recruiter, ...nextJob.recruiter },
						keywords: detectedKeywords,
						selectedTemplateId: template.id,
				  }
				: nextJob;

			const resume = generateResumeDraft(
				baseJob,
				prev,
				template,
				detectedKeywords
			);
			const cover = generateCoverLetterDraft(
				baseJob,
				prev,
				detectedKeywords
			);
			const mergedJob: JobApplication = {
				...baseJob,
				resumeDraft: resume,
				coverLetterDraft: cover,
				versions: existing ? existing.versions : baseJob.versions,
			};
			nextJob = mergedJob;

			const jobs = existing
				? prev.jobs.map((job) => (job.id === existing.id ? mergedJob : job))
				: [...prev.jobs, mergedJob];

			const pendingName = pending?.companyName?.trim();

			return {
				...prev,
				name: pendingName || prev.name,
				jobs,
				auditLog: [
					{
						id: createId(),
						action: `Queued generation payload for ${mergedJob.title}`,
						timestamp: now,
						actor: "System",
					},
					...prev.auditLog,
				].slice(0, 12),
				lastActivity: now.slice(0, 10),
			};
		});

		setSelectedJobId(nextJob.id);
		setJobForm({
			companyName: pending.companyName || company.name,
			jobTitle: nextJob.title,
			jobDescription: nextJob.description,
			jobLink: nextJob.link || "",
			employmentType: nextJob.employmentType || "",
			workMode: nextJob.workMode || "Remote",
			recruiter: nextJob.recruiter,
			extraFields: nextJob.extraFields,
			selectedTemplateId: nextJob.selectedTemplateId,
			notes: nextJob.notes || "",
		});
		setResumeDraft(nextJob.resumeDraft);
		setCoverLetterDraft(nextJob.coverLetterDraft);
	}, [slug, company.name]);

	const handleAddJob = () => {
		const id = createId();
		const newJob: JobApplication = {
			id,
			title: "New role",
			description: "",
			recruiter: {},
			extraFields: [],
			keywords: emptyKeywords,
			selectedTemplateId: templateOptions[0].id,
			resumeDraft: "",
			coverLetterDraft: "",
			versions: [],
		};
		setCompany((prev) => ({
			...prev,
			jobs: [...prev.jobs, newJob],
			lastActivity: new Date().toISOString().slice(0, 10),
		}));
		setSelectedJobId(id);
		setJobForm(createInitialJobForm(company, newJob));
		setResumeDraft("");
		setCoverLetterDraft("");
		addAuditLog({ action: "Started a new job application slot" });
	};

	const handleSaveJob = () => {
		setSavingJob(true);
		setNameError("");

		if (!jobForm.jobDescription.trim()) {
			setSavingJob(false);
			setNameError("Job description is required to anchor keywords.");
			return;
		}

		const normalizedName = jobForm.companyName.trim();
		if (
			normalizedName &&
			normalizedName.toLowerCase() !== company.name.toLowerCase()
		) {
			const duplicate = companyDirectory.find(
				(entry) =>
					entry.name.toLowerCase() === normalizedName.toLowerCase() &&
					entry.id !== company.id
			);
			if (duplicate) {
				setSavingJob(false);
				setNameError(`"${normalizedName}" already exists as a company folder.`);
				return;
			}
		}

		const detectedKeywords = extractKeywords(jobForm.jobDescription);
		const templateId = jobForm.selectedTemplateId || templateOptions[0].id;
		const cleanedExtras = jobForm.extraFields.filter(
			(field) => field.key || field.value
		);

		const updatedJob: JobApplication = {
			id: currentJob?.id || createId(),
			title: jobForm.jobTitle || currentJob?.title || "Untitled role",
			description: jobForm.jobDescription,
			link: jobForm.jobLink,
			employmentType: jobForm.employmentType,
			workMode: jobForm.workMode,
			recruiter: jobForm.recruiter,
			extraFields: cleanedExtras,
			keywords: detectedKeywords,
			selectedTemplateId: templateId,
			resumeDraft,
			coverLetterDraft,
			versions: currentJob?.versions || [],
			notes: jobForm.notes,
		};

		setCompany((prev) => ({
			...prev,
			name: normalizedName || prev.name,
			jobs: prev.jobs.some((job) => job.id === updatedJob.id)
				? prev.jobs.map((job) => (job.id === updatedJob.id ? updatedJob : job))
				: [...prev.jobs, updatedJob],
			lastActivity: new Date().toISOString().slice(0, 10),
		}));

		setSelectedJobId(updatedJob.id);
		addAuditLog({
			action: `Saved job description and keywords for ${
				updatedJob.title || "job"
			}`,
		});
		setSavingJob(false);
	};

	const ensureJob = () => {
		if (currentJob) return currentJob;
		const generatedJob: JobApplication = {
			id: createId(),
			title: jobForm.jobTitle || "New role",
			description: jobForm.jobDescription,
			link: jobForm.jobLink,
			employmentType: jobForm.employmentType,
			workMode: jobForm.workMode,
			recruiter: jobForm.recruiter,
			extraFields: jobForm.extraFields,
			keywords: extractKeywords(jobForm.jobDescription),
			selectedTemplateId: jobForm.selectedTemplateId || templateOptions[0].id,
			resumeDraft,
			coverLetterDraft,
			versions: [],
		};

		setCompany((prev) => ({
			...prev,
			jobs: [...prev.jobs, generatedJob],
		}));
		setSelectedJobId(generatedJob.id);
		return generatedJob;
	};

	const handleGenerateDrafts = () => {
		setGenerating(true);
		const job = ensureJob();
		const template =
			templateOptions.find(
				(option) => option.id === jobForm.selectedTemplateId
			) || templateOptions[0];
		const detectedKeywords = job.keywords.skills.length
			? job.keywords
			: extractKeywords(job.description || jobForm.jobDescription);

		const newResume = generateResumeDraft(
			job,
			company,
			template,
			detectedKeywords
		);
		const newCoverLetter = generateCoverLetterDraft(
			job,
			company,
			detectedKeywords
		);

		setResumeDraft(newResume);
		setCoverLetterDraft(newCoverLetter);

		setCompany((prev) => ({
			...prev,
			jobs: prev.jobs.map((entry) =>
				entry.id === job.id
					? {
							...entry,
							resumeDraft: newResume,
							coverLetterDraft: newCoverLetter,
					  }
					: entry
			),
		}));

		addAuditLog({
			action: `Generated drafts for ${job.title} using ${template.name}`,
		});
		setGenerating(false);
	};

	const rewriteDraft = (
		type: "resume" | "cover",
		mode: "metrics" | "shorten" | "tone"
	) => {
		const text = type === "resume" ? resumeDraft : coverLetterDraft;
		const metricsLine = keywords.responsibilities[0]
			? `Added metrics for "${keywords.responsibilities[0]}" with measurable impact.`
			: "Added quantified metrics to bullets.";
		const rewritten =
			mode === "metrics"
				? `${text}\n- ${metricsLine}`
				: mode === "shorten"
				? text.split("\n").filter(Boolean).slice(0, 6).join("\n")
				: `${text}\n- Adjusted tone for concise, confident delivery.`;

		if (type === "resume") {
			setResumeDraft(rewritten);
		} else {
			setCoverLetterDraft(rewritten);
		}
		addAuditLog({
			action: `Applied ${mode} rewrite to ${
				type === "resume" ? "resume" : "cover letter"
			}`,
		});
	};

	const handleSaveVersion = (type?: DocumentVersion["type"]) => {
		if (!currentJob) return;
		setSavingVersion(true);
		const now = new Date().toISOString();
		const template =
			templateOptions.find(
				(option) => option.id === jobForm.selectedTemplateId
			) || templateOptions[0];

		setCompany((prev) => ({
			...prev,
			jobs: prev.jobs.map((job) => {
				if (job.id !== currentJob.id) return job;

				const targetTypes: DocumentVersion["type"][] = type
					? [type]
					: ["resume", "cover_letter"];
				let versions = [...job.versions];

				targetTypes.forEach((docType) => {
					const version = versionNumber(job, docType);
					const paths = buildPaths(prev.slug, job.title, docType, version);
					const contentTitle =
						docType === "resume"
							? `${job.title} - Resume v${version}`
							: `${job.title} - Cover Letter v${version}`;
					const newVersion: DocumentVersion = {
						id: `${job.id}-${docType}-v${version}`,
						jobId: job.id,
						companyId: prev.id,
						type: docType,
						version,
						title: contentTitle,
						templateId: template.id,
						templateName: template.name,
						createdAt: now,
						keywords: job.keywords || emptyKeywords,
						paths,
						note:
							docType === "resume"
								? "Saved from current resume editor state."
								: "Saved from current cover letter editor state.",
					};
					versions = [...versions, newVersion];
				});

				return {
					...job,
					versions,
					resumeDraft,
					coverLetterDraft,
				};
			}),
			lastActivity: now.slice(0, 10),
		}));

		addAuditLog({
			action: `Saved ${
				type ? type.replace("_", " ") : "resume and cover letter"
			} version for ${currentJob.title || "job"}`,
		});
		setSavingVersion(false);
	};

	const documentsByJob = company.jobs.map((job) => ({
		job,
		documents: [...job.versions].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		),
	}));

	return (
		<div className="min-h-screen">
			<GridBackground />

			<div className="relative px-6 py-8">
				<Button variant="ghost" asChild className="mb-4">
					<Link href="/companies">
						<ChevronLeft className="mr-2 h-4 w-4" />
						Back to Companies
					</Link>
				</Button>

				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
				>
					<div className="space-y-1">
						<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
							<Building2 className="h-8 w-8 text-primary" />
							{company.name}
						</h1>
						<p className="text-muted-foreground">
							Company is the parent directory. Jobs, resumes, and cover letters
							stay nested inside.
						</p>
						{findCompanyBySlug(slug) === undefined && (
							<p className="text-sm text-primary">
								Auto-created because this company did not exist yet.
							</p>
						)}
					</div>
					<div className="flex flex-wrap gap-3">
						<div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
							<ClipboardList className="h-4 w-4 text-primary" />
							<span>{stats.jobCount} job(s)</span>
						</div>
						<div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
							<FileText className="h-4 w-4 text-primary" />
							<span>{stats.resumes} resume(s)</span>
						</div>
						<div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
							<FileText className="h-4 w-4 text-primary" />
							<span>{stats.coverLetters} cover letter(s)</span>
						</div>
						<Button onClick={handleAddJob} variant="outline">
							<Plus className="mr-2 h-4 w-4" />
							Add job
						</Button>
					</div>
				</motion.div>

				<div className="grid gap-6 lg:grid-cols-3">
					<div className="space-y-6 lg:col-span-2">
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FolderOpen className="h-5 w-5" />
									Job Description
								</CardTitle>
								<CardDescription>
									Save the JD to extract keywords and bind everything to the job
									under this company.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="companyName">Company Name</Label>
										<Input
											id="companyName"
											value={jobForm.companyName}
											onChange={(e) =>
												setJobForm({ ...jobForm, companyName: e.target.value })
											}
											placeholder="Company name"
										/>
										{nameError && (
											<p className="text-xs text-destructive">{nameError}</p>
										)}
									</div>
									<div className="space-y-2">
										<Label htmlFor="jobTitle">Job Title</Label>
										<Input
											id="jobTitle"
											value={jobForm.jobTitle}
											onChange={(e) =>
												setJobForm({ ...jobForm, jobTitle: e.target.value })
											}
											placeholder="e.g., Senior Frontend Engineer"
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="jobDescription">
										Job Description <span className="text-destructive">*</span>
									</Label>
									<Textarea
										id="jobDescription"
										rows={6}
										value={jobForm.jobDescription}
										onChange={(e) =>
											setJobForm({ ...jobForm, jobDescription: e.target.value })
										}
										placeholder="Paste the JD to anchor ATS prep and keyword extraction."
										required
									/>
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="jobLink">Job Link</Label>
										<div className="relative">
											<LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
											<Input
												id="jobLink"
												className="pl-9"
												value={jobForm.jobLink}
												onChange={(e) =>
													setJobForm({ ...jobForm, jobLink: e.target.value })
												}
												placeholder="https://"
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label htmlFor="employmentType">Employment Type</Label>
										<Input
											id="employmentType"
											value={jobForm.employmentType}
											onChange={(e) =>
												setJobForm({
													...jobForm,
													employmentType: e.target.value,
												})
											}
											placeholder="Full-time, Contract, Internship"
										/>
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="workMode">Work Mode</Label>
										<select
											id="workMode"
											value={jobForm.workMode}
											onChange={(e) =>
												setJobForm({ ...jobForm, workMode: e.target.value })
											}
											className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										>
											<option>Remote</option>
											<option>Hybrid</option>
											<option>On-site</option>
										</select>
									</div>
									<div className="space-y-2">
										<Label htmlFor="notes">Notes</Label>
										<Input
											id="notes"
											value={jobForm.notes}
											onChange={(e) =>
												setJobForm({ ...jobForm, notes: e.target.value })
											}
											placeholder="Interview loop, timelines, advocates..."
										/>
									</div>
								</div>

								<div className="rounded-lg border p-4">
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<User className="h-4 w-4 text-primary" />
											<p className="text-sm font-medium">
												Recruiter (optional)
											</p>
										</div>
										<span className="text-xs text-muted-foreground">
											Tied only to this job
										</span>
									</div>
									<div className="grid gap-3 md:grid-cols-2">
										<Input
											placeholder="Recruiter name"
											value={jobForm.recruiter.name || ""}
											onChange={(e) =>
												setJobForm({
													...jobForm,
													recruiter: {
														...jobForm.recruiter,
														name: e.target.value,
													},
												})
											}
										/>
										<Input
											placeholder="Email"
											type="email"
											value={jobForm.recruiter.email || ""}
											onChange={(e) =>
												setJobForm({
													...jobForm,
													recruiter: {
														...jobForm.recruiter,
														email: e.target.value,
													},
												})
											}
										/>
										<Input
											placeholder="Phone"
											value={jobForm.recruiter.phone || ""}
											onChange={(e) =>
												setJobForm({
													...jobForm,
													recruiter: {
														...jobForm.recruiter,
														phone: e.target.value,
													},
												})
											}
										/>
										<div className="relative">
											<Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
											<Input
												className="pl-9"
												placeholder="LinkedIn"
												value={jobForm.recruiter.linkedin || ""}
												onChange={(e) =>
													setJobForm({
														...jobForm,
														recruiter: {
															...jobForm.recruiter,
															linkedin: e.target.value,
														},
													})
												}
											/>
										</div>
									</div>
									<Textarea
										className="mt-3"
										rows={2}
										placeholder="Recruiter notes, call outcomes, preferences..."
										value={jobForm.recruiter.notes || ""}
										onChange={(e) =>
											setJobForm({
												...jobForm,
												recruiter: {
													...jobForm.recruiter,
													notes: e.target.value,
												},
											})
										}
									/>
								</div>

								<div className="rounded-lg border p-4">
									<div className="mb-3 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<ListChecks className="h-4 w-4 text-primary" />
											<p className="text-sm font-medium">Extra fields</p>
										</div>
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() =>
												setJobForm({
													...jobForm,
													extraFields: [
														...jobForm.extraFields,
														{ key: "", value: "" },
													],
												})
											}
										>
											<Plus className="mr-1 h-4 w-4" /> Add field
										</Button>
									</div>
									{jobForm.extraFields.length > 0 ? (
										<div className="space-y-2">
											{jobForm.extraFields.map((field, index) => (
												<div
													key={`${field.key}-${index}`}
													className="grid gap-2 md:grid-cols-2"
												>
													<Input
														placeholder="Key (Referral, Salary, Notice period...)"
														value={field.key}
														onChange={(e) => {
															const next = [...jobForm.extraFields];
															next[index] = { ...field, key: e.target.value };
															setJobForm({ ...jobForm, extraFields: next });
														}}
													/>
													<Input
														placeholder="Value"
														value={field.value}
														onChange={(e) => {
															const next = [...jobForm.extraFields];
															next[index] = { ...field, value: e.target.value };
															setJobForm({ ...jobForm, extraFields: next });
														}}
													/>
												</div>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											No custom fields yet. Add referral, salary, notice period,
											or any special constraints.
										</p>
									)}
								</div>

								<div className="flex flex-wrap justify-end gap-2">
									<Button
										variant="outline"
										onClick={() => router.push("/companies")}
										type="button"
									>
										Back
									</Button>
									<Button onClick={handleSaveJob} disabled={savingJob}>
										{savingJob ? (
											<>
												<Save className="mr-2 h-4 w-4 animate-spin" />
												Saving...
											</>
										) : (
											<>
												<Save className="mr-2 h-4 w-4" />
												Save description
											</>
										)}
									</Button>
								</div>
							</CardContent>
						</Card>

						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Sparkles className="h-5 w-5 text-primary" />
										ATS Keywords
									</CardTitle>
									<CardDescription>
										Extracted from the saved job description.
									</CardDescription>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setJobForm({
											...jobForm,
											jobDescription: jobForm.jobDescription,
										})
									}
								>
									Refresh extraction
								</Button>
							</CardHeader>
							<CardContent className="grid gap-3 md:grid-cols-2">
								{(
									["skills", "tools", "responsibilities", "domains"] as const
								).map((key) => (
									<div key={key} className="rounded-lg border p-3">
										<p className="text-xs uppercase text-muted-foreground">
											{key}
										</p>
										<div className="mt-2 flex flex-wrap gap-2">
											{keywords[key].length > 0 ? (
												keywords[key].map((item) => (
													<span
														key={item}
														className="rounded-full bg-secondary px-2 py-1 text-xs"
													>
														{item}
													</span>
												))
											) : (
												<p className="text-xs text-muted-foreground">
													No {key} detected yet.
												</p>
											)}
										</div>
									</div>
								))}
							</CardContent>
						</Card>

						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Layers className="h-5 w-5" />
									JSON Resume Template
								</CardTitle>
								<CardDescription>
									Choose the JSON Resume layout before generating drafts.
								</CardDescription>
							</CardHeader>
							<CardContent className="grid gap-3 md:grid-cols-3">
								{templateOptions.map((template) => {
									const isActive = jobForm.selectedTemplateId === template.id;
									return (
										<button
											type="button"
											key={template.id}
											onClick={() =>
												setJobForm({
													...jobForm,
													selectedTemplateId: template.id,
												})
											}
											className={cn(
												"flex h-full flex-col rounded-lg border p-3 text-left transition-colors",
												isActive
													? "border-primary bg-primary/5 shadow-sm"
													: "border-border hover:border-primary/50"
											)}
										>
											<div className="flex items-center justify-between">
												<p className="font-semibold">{template.name}</p>
												{isActive ? (
													<CheckCircle2 className="h-4 w-4 text-primary" />
												) : (
													<XCircle className="h-4 w-4 text-muted-foreground" />
												)}
											</div>
											<p className="text-xs text-muted-foreground">
												{template.style} - {template.locale}
											</p>
											<p className="mt-2 text-sm">{template.preview}</p>
											<ul className="mt-2 space-y-1 text-xs text-muted-foreground">
												{template.emphasis.map((item) => (
													<li key={item}>- {item}</li>
												))}
											</ul>
										</button>
									);
								})}
							</CardContent>
						</Card>

						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Wand2 className="h-5 w-5" />
										Review & Generate
									</CardTitle>
									<CardDescription>
										Base generation on your profile, JD keywords, and chosen
										template.
									</CardDescription>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={handleGenerateDrafts}
										disabled={generating}
									>
										<Sparkles className="mr-2 h-4 w-4" />
										{generating ? "Generating..." : "Generate drafts"}
									</Button>
									<Button
										size="sm"
										onClick={() => handleSaveVersion()}
										disabled={savingVersion}
									>
										<Save className="mr-2 h-4 w-4" />
										Save resume + cover
									</Button>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="rounded-lg border p-3">
									<div className="mb-2 flex items-center justify-between">
										<p className="text-sm font-medium">Resume draft</p>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => rewriteDraft("resume", "metrics")}
											>
												Add metrics
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => rewriteDraft("resume", "shorten")}
											>
												Shorten
											</Button>
										</div>
									</div>
									<Textarea
										value={resumeDraft}
										onChange={(e) => setResumeDraft(e.target.value)}
										rows={6}
										placeholder="Resume content will appear here..."
									/>
								</div>

								<div className="rounded-lg border p-3">
									<div className="mb-2 flex items-center justify-between">
										<p className="text-sm font-medium">Cover letter draft</p>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => rewriteDraft("cover", "tone")}
											>
												Improve tone
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => rewriteDraft("cover", "shorten")}
											>
												Tighten
											</Button>
										</div>
									</div>
									<Textarea
										value={coverLetterDraft}
										onChange={(e) => setCoverLetterDraft(e.target.value)}
										rows={5}
										placeholder="Cover letter content will appear here..."
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<History className="h-5 w-5" />
									Version History (Job)
								</CardTitle>
								<CardDescription>
									Every resume and cover letter sits under Company {"->"} Job{" "}
									{"->"} Documents.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{currentJob && currentJob.versions.length > 0 ? (
									[...currentJob.versions]
										.sort(
											(a, b) =>
												new Date(b.createdAt).getTime() -
												new Date(a.createdAt).getTime()
										)
										.map((version) => (
											<div
												key={version.id}
												className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/50 p-3"
											>
												<div>
													<p className="font-medium">
														{version.title} ({version.type})
													</p>
													<p className="text-xs text-muted-foreground">
														Template: {version.templateName} - v
														{version.version} - {version.createdAt}
													</p>
												</div>
												<div className="flex gap-2">
													<Button variant="outline" size="sm" asChild>
														<a href={`/${version.paths.pdf}`} download>
															PDF
														</a>
													</Button>
													<Button variant="outline" size="sm" asChild>
														<a href={`/${version.paths.docx}`} download>
															DOCX
														</a>
													</Button>
												</div>
											</div>
										))
								) : (
									<p className="text-sm text-muted-foreground">
										No versions yet. Generate drafts and save a version to start
										tracking.
									</p>
								)}
							</CardContent>
						</Card>
					</div>

					<div className="space-y-6">
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader className="flex flex-row items-center justify-between">
								<div>
									<CardTitle className="flex items-center gap-2 text-lg">
										<ClipboardList className="h-5 w-5" />
										Jobs in this company
									</CardTitle>
									<CardDescription>
										Switch jobs to keep outputs scoped correctly.
									</CardDescription>
								</div>
								<Button size="sm" variant="outline" onClick={handleAddJob}>
									<Plus className="mr-1 h-4 w-4" /> Job
								</Button>
							</CardHeader>
							<CardContent className="space-y-2">
								{company.jobs.length > 0 ? (
									company.jobs.map((job) => {
										const resumeCount = job.versions.filter(
											(v) => v.type === "resume"
										).length;
										const coverCount = job.versions.filter(
											(v) => v.type === "cover_letter"
										).length;
										const isActive = job.id === selectedJobId;
										return (
											<button
												key={job.id}
												onClick={() => setSelectedJobId(job.id)}
												className={cn(
													"w-full rounded-lg border px-3 py-2 text-left transition-colors",
													isActive
														? "border-primary bg-primary/5"
														: "border-border hover:border-primary/50"
												)}
											>
												<div className="flex items-center justify-between">
													<div>
														<p className="font-medium">{job.title}</p>
														<p className="text-xs text-muted-foreground">
															{resumeCount} resume(s) - {coverCount} cover
															letter(s)
														</p>
													</div>
													{isActive && (
														<span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
															Active
														</span>
													)}
												</div>
											</button>
										);
									})
								) : (
									<p className="text-sm text-muted-foreground">
										No jobs yet. Add one to start organizing documents.
									</p>
								)}
							</CardContent>
						</Card>

						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<FileText className="h-5 w-5" />
									Documents by job
								</CardTitle>
								<CardDescription>
									All resumes and cover letters stay under this company.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{documentsByJob.length > 0 ? (
									documentsByJob.map(({ job, documents }) => (
										<div
											key={job.id}
											className="space-y-2 rounded-lg border p-3"
										>
											<div className="flex items-center justify-between">
												<div>
													<p className="font-semibold">{job.title}</p>
													<p className="text-xs text-muted-foreground">
														Template:{" "}
														{
															(
																templateOptions.find(
																	(t) => t.id === job.selectedTemplateId
																) || templateOptions[0]
															).name
														}
													</p>
												</div>
												<span className="rounded-full bg-secondary px-2 py-1 text-xs">
													{documents.length} version(s)
												</span>
											</div>
											{documents.length > 0 ? (
												documents.map((doc) => (
													<div
														key={doc.id}
														className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background/70 p-2"
													>
														<div>
															<p className="text-sm font-medium">
																{doc.title} ({doc.type})
															</p>
															<p className="text-xs text-muted-foreground">
																Template {doc.templateName} - v{doc.version} -{" "}
																{doc.createdAt}
															</p>
															<p className="text-[11px] text-muted-foreground">
																PDF: {doc.paths.pdf}
															</p>
														</div>
														<div className="flex gap-2">
															<Button size="sm" variant="outline" asChild>
																<a href={`/${doc.paths.pdf}`} download>
																	Download PDF
																</a>
															</Button>
															<Button size="sm" variant="outline" asChild>
																<a href={`/${doc.paths.docx}`} download>
																	DOCX
																</a>
															</Button>
														</div>
													</div>
												))
											) : (
												<p className="text-sm text-muted-foreground">
													No documents yet for this job.
												</p>
											)}
										</div>
									))
								) : (
									<p className="text-sm text-muted-foreground">
										Nothing generated yet. Save a job description, generate
										drafts, and save a version to see documents grouped here.
									</p>
								)}
							</CardContent>
						</Card>

						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<History className="h-5 w-5" />
									Audit log
								</CardTitle>
								<CardDescription>
									Tracks AI generations and manual edits per company.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								{company.auditLog.length > 0 ? (
									company.auditLog.map((entry) => (
										<div
											key={entry.id}
											className="rounded-lg border bg-background/50 p-3"
										>
											<p className="text-sm font-medium">{entry.action}</p>
											<p className="text-xs text-muted-foreground">
												{entry.actor} - {entry.timestamp}
											</p>
										</div>
									))
								) : (
									<p className="text-sm text-muted-foreground">
										No activity yet. Saving job descriptions or versions will
										record an entry.
									</p>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
