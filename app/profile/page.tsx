"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GridBackground } from "@/components/ui/aceternity";
import {
	User,
	Mail,
	Phone,
	MapPin,
	Globe,
	LinkedinIcon,
	GithubIcon,
	Briefcase,
	GraduationCap,
	FileText,
	Plus,
	X,
	Save,
	Camera,
	Trash2,
	ChevronLeft,
	Upload,
	Sparkles,
	PlusCircle,
	Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Profile type definition
type WorkExperience = {
	id: string;
	company: string;
	role: string;
	location: string;
	start_date: string;
	end_date: string | null;
	description: string;
};

type Education = {
	id: string;
	institution: string;
	degree: string;
	location: string;
	start_date: string;
	end_date: string;
};

type CustomField = { id: string; label: string; value: string };
type CustomEntry = { id: string; title: string; value: string };
type CustomSection = { id: string; title: string; entries: CustomEntry[] };

type ProfileData = {
	id: string;
	full_name: string;
	email: string;
	phone: string;
	location: string;
	bio: string;
	website: string;
	linkedin_url: string;
	github_url: string;
	avatar_url: string | undefined;
	skills: string[];
	work_experience: WorkExperience[];
	education: Education[];
	custom_fields: CustomField[];
};

// Empty initial state - will be populated from Supabase
const emptyProfile: ProfileData = {
	id: "",
	full_name: "",
	email: "",
	phone: "",
	location: "",
	bio: "",
	website: "",
	linkedin_url: "",
	github_url: "",
	avatar_url: undefined,
	skills: [],
	work_experience: [],
	education: [],
	custom_fields: [],
};

type Tab = string;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMPORT_EXTS = [".pdf", ".docx", ".txt"];

const createId = () =>
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2);

export default function ProfilePage() {
	const user = { name: "User", avatarUrl: undefined };
	const [activeTab, setActiveTab] = useState<Tab>("personal");
	const [profile, setProfile] = useState<ProfileData>(emptyProfile);
	const [isSaving, setIsSaving] = useState(false);
	const [newSkill, setNewSkill] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const importInputRef = useRef<HTMLInputElement>(null);
	const [customSections, setCustomSections] = useState<CustomSection[]>([]);
	const [newSectionTitle, setNewSectionTitle] = useState("");
	const [importing, setImporting] = useState(false);
	const [importError, setImportError] = useState<string | null>(null);
	const [importNotice, setImportNotice] = useState<string | null>(null);
	const [importedFileName, setImportedFileName] = useState<string | null>(null);

	const baseTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
		{
			id: "personal",
			label: "Personal Info",
			icon: <User className="h-4 w-4" />,
		},
		{
			id: "experience",
			label: "Work Experience",
			icon: <Briefcase className="h-4 w-4" />,
		},
		{
			id: "education",
			label: "Education",
			icon: <GraduationCap className="h-4 w-4" />,
		},
		{ id: "skills", label: "Skills", icon: <FileText className="h-4 w-4" /> },
	];

	const tabs = [
		...baseTabs,
		...customSections.map((section) => ({
			id: `custom-${section.id}`,
			label: section.title,
			icon: <Sparkles className="h-4 w-4" />,
		})),
	];

	const handleSave = async () => {
		setIsSaving(true);
		// TODO: Call API to persist profile changes
		await new Promise((resolve) => setTimeout(resolve, 1000));
		setIsSaving(false);
	};

	const mergeSkills = (incoming: string[]) =>
		Array.from(new Set([...profile.skills, ...incoming.filter(Boolean)]));

	const handleAddSkill = () => {
		if (newSkill && !profile.skills.includes(newSkill)) {
			setProfile({ ...profile, skills: [...profile.skills, newSkill] });
			setNewSkill("");
		}
	};

	const handleRemoveSkill = (skill: string) => {
		setProfile({
			...profile,
			skills: profile.skills.filter((s) => s !== skill),
		});
	};

	const handlePhotoClick = () => {
		fileInputRef.current?.click();
	};

	const handleAddExperience = () => {
		setProfile((prev) => ({
			...prev,
			work_experience: [
				...prev.work_experience,
				{
					id: createId(),
					company: "",
					role: "",
					location: "",
					start_date: "",
					end_date: "",
					description: "",
				},
			],
		}));
	};

	const handleUpdateExperience = (
		id: string,
		patch: Partial<WorkExperience>
	) => {
		setProfile((prev) => ({
			...prev,
			work_experience: prev.work_experience.map((exp) =>
				exp.id === id ? { ...exp, ...patch } : exp
			),
		}));
	};

	const handleRemoveExperience = (id: string) => {
		setProfile((prev) => ({
			...prev,
			work_experience: prev.work_experience.filter((exp) => exp.id !== id),
		}));
	};

	const handleAddEducation = () => {
		setProfile((prev) => ({
			...prev,
			education: [
				...prev.education,
				{
					id: createId(),
					institution: "",
					degree: "",
					location: "",
					start_date: "",
					end_date: "",
				},
			],
		}));
	};

	const handleUpdateEducation = (id: string, patch: Partial<Education>) => {
		setProfile((prev) => ({
			...prev,
			education: prev.education.map((edu) =>
				edu.id === id ? { ...edu, ...patch } : edu
			),
		}));
	};

	const handleRemoveEducation = (id: string) => {
		setProfile((prev) => ({
			...prev,
			education: prev.education.filter((edu) => edu.id !== id),
		}));
	};

	const handleAddField = () => {
		setProfile((prev) => ({
			...prev,
			custom_fields: [
				...prev.custom_fields,
				{ id: createId(), label: "Label", value: "" },
			],
		}));
	};

	const handleUpdateField = (id: string, patch: Partial<CustomField>) => {
		setProfile((prev) => ({
			...prev,
			custom_fields: prev.custom_fields.map((field) =>
				field.id === id ? { ...field, ...patch } : field
			),
		}));
	};

	const handleRemoveField = (id: string) => {
		setProfile((prev) => ({
			...prev,
			custom_fields: prev.custom_fields.filter((field) => field.id !== id),
		}));
	};

	const handleAddCustomSection = (
		title?: string,
		entries: CustomEntry[] = []
	) => {
		const normalizedTitle = (title || newSectionTitle).trim();
		if (!normalizedTitle) return;

		const newSection: CustomSection = {
			id: createId(),
			title: normalizedTitle,
			entries: entries.length
				? entries
				: [{ id: createId(), title: "", value: "" }],
		};

		setCustomSections((prev) => [...prev, newSection]);
		setActiveTab(`custom-${newSection.id}`);
		setNewSectionTitle("");
	};

	const handleRemoveCustomSection = (sectionId: string) => {
		setCustomSections((prev) =>
			prev.filter((section) => section.id !== sectionId)
		);
		if (activeTab === `custom-${sectionId}`) {
			setActiveTab("personal");
		}
	};

	const handleUpdateCustomEntry = (
		sectionId: string,
		entryId: string,
		patch: Partial<CustomEntry>
	) => {
		setCustomSections((prev) =>
			prev.map((section) =>
				section.id === sectionId
					? {
							...section,
							entries: section.entries.map((entry) =>
								entry.id === entryId ? { ...entry, ...patch } : entry
							),
					  }
					: section
			)
		);
	};

	const handleAddCustomEntry = (sectionId: string) => {
		setCustomSections((prev) =>
			prev.map((section) =>
				section.id === sectionId
					? {
							...section,
							entries: [
								...section.entries,
								{ id: createId(), title: "", value: "" },
							],
					  }
					: section
			)
		);
	};

	const handleRemoveCustomEntry = (sectionId: string, index: number) => {
		setCustomSections((prev) =>
			prev.map((section) =>
				section.id === sectionId
					? {
							...section,
							entries: section.entries.filter((_, i) => i !== index),
					  }
					: section
			)
		);
	};

	const handleImportFile = async (file: File) => {
		setImportError(null);
		setImportNotice(null);
		setImportedFileName(null);

		const lowerName = file.name.toLowerCase();
		const hasValidExtension = ALLOWED_IMPORT_EXTS.some((ext) =>
			lowerName.endsWith(ext)
		);
		if (!hasValidExtension) {
			setImportError("Use PDF, DOCX, or TXT files up to 5MB.");
			return;
		}
		if (file.size > MAX_IMPORT_BYTES) {
			setImportError("File must be 5MB or smaller.");
			return;
		}

		setImporting(true);
		try {
			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch("/api/profile/extract", {
				method: "POST",
				body: formData,
			});

			const body = await response.json().catch(() => ({}));
			if (!response.ok) {
				setImportError(
					body.error ||
						"Unable to extract data from the file. Please try again."
				);
				return;
			}

			const normalizedExperience: WorkExperience[] = (
				body.work_experience || []
			).map((exp: WorkExperience) => ({
				id: exp.id || createId(),
				company: exp.company || "",
				role: exp.role || "",
				location: exp.location || "",
				start_date: exp.start_date || "",
				end_date: exp.end_date || "",
				description: exp.description || "",
			}));

			const normalizedEducation: Education[] = (body.education || []).map(
				(edu: Education) => ({
					id: edu.id || createId(),
					institution: edu.institution || "",
					degree: edu.degree || "",
					location: edu.location || "",
					start_date: edu.start_date || "",
					end_date: edu.end_date || "",
				})
			);

			const normalizedCustomSections: CustomSection[] = (
				body.customSections || []
			).map((section: CustomSection) => ({
				id: section.id || createId(),
				title: section.title || "Imported Section",
				entries: section.entries?.length
					? section.entries.map((entry: any) =>
							typeof entry === "string"
								? { id: createId(), title: "", value: entry }
								: {
										id: entry.id || createId(),
										title: entry.title || "",
										value: entry.value || "",
								  }
					  )
					: [
							{
								id: createId(),
								title: "",
								value: "Review and fill this section",
							},
					  ],
			}));

			setProfile((prev) => ({
				...prev,
				full_name: body.profile?.full_name || prev.full_name,
				email: body.profile?.email || prev.email,
				phone: body.profile?.phone || prev.phone,
				bio: body.profile?.summary || prev.bio,
				skills: mergeSkills(body.skills || []),
				work_experience:
					normalizedExperience.length > 0
						? normalizedExperience
						: prev.work_experience,
				education:
					normalizedEducation.length > 0 ? normalizedEducation : prev.education,
			}));

			if (normalizedCustomSections.length > 0) {
				setCustomSections((prev) => {
					const merged = [...prev];
					normalizedCustomSections.forEach((section) => {
						const existingIndex = merged.findIndex(
							(s) => s.title.toLowerCase() === section.title.toLowerCase()
						);
						if (existingIndex >= 0) {
							const seen = new Set<string>();
							const mergedEntries: CustomEntry[] = [];
							[...merged[existingIndex].entries, ...section.entries].forEach(
								(entry) => {
									const key = `${entry.title}|${entry.value}`;
									if (seen.has(key)) return;
									seen.add(key);
									mergedEntries.push(entry);
								}
							);
							merged[existingIndex] = {
								...merged[existingIndex],
								entries: mergedEntries,
							};
						} else {
							merged.push(section);
						}
					});
					return merged;
				});
			}

			setImportedFileName(body.fileName || file.name);
			setImportNotice(
				"Imported details from your resume. Review and edit as needed."
			);
		} catch (error) {
			setImportError("Unable to extract data right now. Please try again.");
		} finally {
			setImporting(false);
		}
	};

	return (
		<div className="min-h-screen">
			<NavBar user={user} />
			<GridBackground />

			<div className="container relative max-w-4xl px-4 py-8">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-8"
				>
					<Button variant="ghost" asChild className="mb-4">
						<Link href="/dashboard">
							<ChevronLeft className="mr-1 h-4 w-4" />
							Back to Dashboard
						</Link>
					</Button>
					<h1 className="text-3xl font-bold tracking-tight">
						Profile Settings
					</h1>
					<p className="mt-1 text-muted-foreground">
						Manage your personal information, experience, and skills. This data
						will be used to generate resumes.
					</p>
				</motion.div>

				{/* Tab Navigation */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-6"
				>
					<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/80 p-2 backdrop-blur">
						<div className="flex flex-wrap gap-2">
							{tabs.map((tab) => (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={cn(
										"flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
										activeTab === tab.id
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:bg-muted hover:text-foreground"
									)}
								>
									{tab.icon}
									{tab.label}
								</button>
							))}
						</div>

						<div className="ml-auto flex flex-1 flex-wrap items-center gap-2 sm:flex-none">
							<Input
								placeholder="Add custom section (e.g., Projects)"
								value={newSectionTitle}
								onChange={(e) => setNewSectionTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										handleAddCustomSection();
									}
								}}
								className="min-w-[180px] flex-1"
							/>
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleAddCustomSection()}
								disabled={!newSectionTitle.trim()}
							>
								<PlusCircle className="mr-2 h-4 w-4" />
								Add Section
							</Button>
						</div>
					</div>
				</motion.div>

				{/* Content */}
				<motion.div
					key={activeTab}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.2 }}
				>
					{/* Personal Info Tab */}
					{activeTab === "personal" && (
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle>Personal Information</CardTitle>
								<CardDescription>
									Your basic contact information and professional summary.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								<div className="rounded-lg border border-dashed bg-muted/40 p-4">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
										<div>
											<p className="flex items-center gap-2 text-sm font-medium">
												<Upload className="h-4 w-4" />
												Extract from resume
											</p>
											<p className="text-xs text-muted-foreground">
												Upload a PDF, DOCX, or TXT to prefill fields and
												auto-create sections like Projects or Certifications.
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => importInputRef.current?.click()}
												disabled={importing}
											>
												{importing ? (
													<>
														<span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
														Extracting...
													</>
												) : (
													<>
														<Wand2 className="mr-2 h-4 w-4" />
														Upload & extract
													</>
												)}
											</Button>
										</div>
									</div>
									<input
										ref={importInputRef}
										type="file"
										accept=".pdf,.docx,.txt"
										className="hidden"
										onChange={(e) => {
											const file = e.target.files?.[0];
											if (file) {
												void handleImportFile(file);
												e.target.value = "";
											}
										}}
									/>
									{importError && (
										<div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
											{importError}
										</div>
									)}
									{importNotice && (
										<div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
											{importNotice}
											{importedFileName ? ` (${importedFileName})` : ""}
										</div>
									)}
								</div>

								{/* Profile Photo */}
								<div className="flex items-center gap-6">
									<div className="relative">
										<div
											onClick={handlePhotoClick}
											className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted transition-colors hover:border-primary"
										>
											{profile.avatar_url ? (
												<img
													src={profile.avatar_url}
													alt="Profile"
													className="h-full w-full object-cover"
												/>
											) : (
												<Camera className="h-8 w-8 text-muted-foreground" />
											)}
										</div>
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											className="hidden"
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (file) {
													// TODO: Upload to storage
													const url = URL.createObjectURL(file);
													setProfile({ ...profile, avatar_url: url });
												}
											}}
										/>
									</div>
									<div>
										<p className="font-medium">Profile Photo</p>
										<p className="text-sm text-muted-foreground">
											Required for German/EU applications. Click to upload.
										</p>
										{profile.avatar_url && (
											<Button
												variant="ghost"
												size="sm"
												className="mt-1 h-7 text-destructive"
												onClick={() =>
													setProfile({ ...profile, avatar_url: undefined })
												}
											>
												<Trash2 className="mr-1 h-3 w-3" />
												Remove
											</Button>
										)}
									</div>
								</div>

								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="fullName">
											<User className="mr-2 inline h-4 w-4" />
											Full Name
										</Label>
										<Input
											id="fullName"
											value={profile.full_name}
											onChange={(e) =>
												setProfile({ ...profile, full_name: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="email">
											<Mail className="mr-2 inline h-4 w-4" />
											Email
										</Label>
										<Input
											id="email"
											type="email"
											value={profile.email}
											onChange={(e) =>
												setProfile({ ...profile, email: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="phone">
											<Phone className="mr-2 inline h-4 w-4" />
											Phone
										</Label>
										<Input
											id="phone"
											value={profile.phone}
											onChange={(e) =>
												setProfile({ ...profile, phone: e.target.value })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="location">
											<MapPin className="mr-2 inline h-4 w-4" />
											Location
										</Label>
										<Input
											id="location"
											value={profile.location}
											onChange={(e) =>
												setProfile({ ...profile, location: e.target.value })
											}
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="bio">Professional Summary</Label>
									<Textarea
										id="bio"
										rows={4}
										value={profile.bio}
										onChange={(e) =>
											setProfile({ ...profile, bio: e.target.value })
										}
										placeholder="Brief summary of your professional background and expertise..."
									/>
								</div>

								<div className="grid gap-4 sm:grid-cols-3">
									<div className="space-y-2">
										<Label htmlFor="website">
											<Globe className="mr-2 inline h-4 w-4" />
											Website
										</Label>
										<Input
											id="website"
											value={profile.website}
											onChange={(e) =>
												setProfile({ ...profile, website: e.target.value })
											}
											placeholder="https://"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="linkedin">
											<LinkedinIcon className="mr-2 inline h-4 w-4" />
											LinkedIn
										</Label>
										<Input
											id="linkedin"
											value={profile.linkedin_url}
											onChange={(e) =>
												setProfile({ ...profile, linkedin_url: e.target.value })
											}
											placeholder="https://linkedin.com/in/..."
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="github">
											<GithubIcon className="mr-2 inline h-4 w-4" />
											GitHub
										</Label>
										<Input
											id="github"
											value={profile.github_url}
											onChange={(e) =>
												setProfile({ ...profile, github_url: e.target.value })
											}
											placeholder="https://github.com/..."
										/>
									</div>
								</div>

								<div className="rounded-lg border bg-muted/40 p-4">
									<div className="flex items-center justify-between gap-2">
										<p className="text-sm font-medium">Additional fields</p>
										<Button
											variant="outline"
											size="sm"
											onClick={handleAddField}
										>
											<Plus className="mr-2 h-4 w-4" />
											Add field
										</Button>
									</div>
									{profile.custom_fields.length > 0 ? (
										<div className="mt-3 space-y-2">
											{profile.custom_fields.map((field) => (
												<div
													key={field.id}
													className="grid gap-2 sm:grid-cols-[1fr,2fr,auto]"
												>
													<Input
														placeholder="Label"
														value={field.label}
														onChange={(e) =>
															handleUpdateField(field.id, {
																label: e.target.value,
															})
														}
													/>
													<Input
														placeholder="Value"
														value={field.value}
														onChange={(e) =>
															handleUpdateField(field.id, {
																value: e.target.value,
															})
														}
													/>
													<Button
														variant="ghost"
														size="icon"
														className="h-9 w-9 text-destructive"
														onClick={() => handleRemoveField(field.id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									) : (
										<p className="mt-2 text-xs text-muted-foreground">
											Need visa status, portfolio password, or other custom
											info? Add a field above.
										</p>
									)}
								</div>
							</CardContent>
						</Card>
					)}

					{/* Work Experience Tab */}
					{activeTab === "experience" && (
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader className="flex flex-row items-center justify-between">
								<div>
									<CardTitle>Work Experience</CardTitle>
									<CardDescription>
										Your professional work history.
									</CardDescription>
								</div>
								<Button onClick={handleAddExperience} variant="outline">
									<Plus className="mr-2 h-4 w-4" />
									Add Experience
								</Button>
							</CardHeader>
							<CardContent className="space-y-4">
								{profile.work_experience.length > 0 ? (
									profile.work_experience.map((exp) => (
										<div
											key={exp.id}
											className="rounded-lg border bg-background/50 p-4"
										>
											<div className="mb-4 flex items-start justify-between">
												<div>
													<h4 className="font-medium">
														{exp.role || "Role / Title"}
													</h4>
													<p className="text-sm text-muted-foreground">
														{exp.company || "Company"} ·{" "}
														{exp.location || "Location"}
													</p>
													<p className="text-xs text-muted-foreground">
														{exp.start_date || "Start"} -{" "}
														{exp.end_date || "Present"}
													</p>
												</div>
												<div className="flex gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive"
														onClick={() => handleRemoveExperience(exp.id)}
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</div>
											<div className="space-y-3">
												<div className="grid gap-4 sm:grid-cols-2">
													<div className="space-y-2">
														<Label>Job Title</Label>
														<Input
															value={exp.role}
															onChange={(e) =>
																handleUpdateExperience(exp.id, {
																	role: e.target.value,
																})
															}
														/>
													</div>
													<div className="space-y-2">
														<Label>Company</Label>
														<Input
															value={exp.company}
															onChange={(e) =>
																handleUpdateExperience(exp.id, {
																	company: e.target.value,
																})
															}
														/>
													</div>
													<div className="space-y-2">
														<Label>Location</Label>
														<Input
															value={exp.location}
															onChange={(e) =>
																handleUpdateExperience(exp.id, {
																	location: e.target.value,
																})
															}
														/>
													</div>
													<div className="grid grid-cols-2 gap-2">
														<div className="space-y-2">
															<Label>Start</Label>
															<Input
																type="text"
																value={exp.start_date || ""}
																onChange={(e) =>
																	handleUpdateExperience(exp.id, {
																		start_date: e.target.value,
																	})
																}
															/>
														</div>
														<div className="space-y-2">
															<Label>End</Label>
															<Input
																type="text"
																value={exp.end_date || ""}
																placeholder="Present"
																onChange={(e) =>
																	handleUpdateExperience(exp.id, {
																		end_date: e.target.value,
																	})
																}
															/>
														</div>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Description</Label>
													<Textarea
														rows={3}
														value={exp.description}
														onChange={(e) =>
															handleUpdateExperience(exp.id, {
																description: e.target.value,
															})
														}
														placeholder="Key responsibilities and achievements..."
													/>
												</div>
											</div>
										</div>
									))
								) : (
									<div className="flex flex-col items-center justify-center py-12 text-center">
										<Briefcase className="mb-3 h-12 w-12 text-muted-foreground/50" />
										<p className="mb-1 font-medium">No work experience added</p>
										<p className="mb-4 text-sm text-muted-foreground">
											Add your professional experience to build better resumes
										</p>
										<Button>
											<Plus className="mr-2 h-4 w-4" />
											Add Your First Experience
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Education Tab */}
					{activeTab === "education" && (
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader className="flex flex-row items-center justify-between">
								<div>
									<CardTitle>Education</CardTitle>
									<CardDescription>Your academic background.</CardDescription>
								</div>
								<Button onClick={handleAddEducation} variant="outline">
									<Plus className="mr-2 h-4 w-4" />
									Add Education
								</Button>
							</CardHeader>
							<CardContent className="space-y-4">
								{profile.education.length > 0 ? (
									profile.education.map((edu) => (
										<div
											key={edu.id}
											className="rounded-lg border bg-background/50 p-4"
										>
											<div className="mb-4 flex items-start justify-between">
												<div>
													<h4 className="font-medium">
														{edu.degree || "Degree"}
													</h4>
													<p className="text-sm text-muted-foreground">
														{edu.institution || "Institution"} ·{" "}
														{edu.location || "Location"}
													</p>
													<p className="text-xs text-muted-foreground">
														{edu.start_date || "Start"} -{" "}
														{edu.end_date || "End"}
													</p>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-destructive"
													onClick={() => handleRemoveEducation(edu.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
											<div className="grid gap-4 sm:grid-cols-2">
												<div className="space-y-2">
													<Label>Degree</Label>
													<Input
														value={edu.degree}
														onChange={(e) =>
															handleUpdateEducation(edu.id, {
																degree: e.target.value,
															})
														}
													/>
												</div>
												<div className="space-y-2">
													<Label>Institution</Label>
													<Input
														value={edu.institution}
														onChange={(e) =>
															handleUpdateEducation(edu.id, {
																institution: e.target.value,
															})
														}
													/>
												</div>
												<div className="space-y-2">
													<Label>Location</Label>
													<Input
														value={edu.location}
														onChange={(e) =>
															handleUpdateEducation(edu.id, {
																location: e.target.value,
															})
														}
													/>
												</div>
												<div className="grid grid-cols-2 gap-2">
													<div className="space-y-2">
														<Label>Start</Label>
														<Input
															type="text"
															value={edu.start_date}
															onChange={(e) =>
																handleUpdateEducation(edu.id, {
																	start_date: e.target.value,
																})
															}
														/>
													</div>
													<div className="space-y-2">
														<Label>End</Label>
														<Input
															type="text"
															value={edu.end_date}
															onChange={(e) =>
																handleUpdateEducation(edu.id, {
																	end_date: e.target.value,
																})
															}
														/>
													</div>
												</div>
											</div>
										</div>
									))
								) : (
									<div className="flex flex-col items-center justify-center py-12 text-center">
										<GraduationCap className="mb-3 h-12 w-12 text-muted-foreground/50" />
										<p className="mb-1 font-medium">No education added</p>
										<p className="mb-4 text-sm text-muted-foreground">
											Add your academic background to strengthen your profile
										</p>
										<Button onClick={handleAddEducation}>
											<Plus className="mr-2 h-4 w-4" />
											Add Your First Education
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Skills Tab */}
					{activeTab === "skills" && (
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle>Skills & Technologies</CardTitle>
								<CardDescription>
									Add skills that will be matched against job descriptions.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{/* Add Skill */}
								<div className="flex gap-2">
									<Input
										placeholder="Add a skill..."
										value={newSkill}
										onChange={(e) => setNewSkill(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												handleAddSkill();
											}
										}}
									/>
									<Button onClick={handleAddSkill}>
										<Plus className="mr-2 h-4 w-4" />
										Add
									</Button>
								</div>

								{/* Skills List */}
								{profile.skills.length > 0 ? (
									<div className="flex flex-wrap gap-2">
										{profile.skills.map((skill) => (
											<span
												key={skill}
												className="flex items-center gap-1 rounded-full border bg-secondary px-3 py-1 text-sm font-medium"
											>
												{skill}
												<button
													onClick={() => handleRemoveSkill(skill)}
													className="ml-1 rounded-full p-0.5 hover:bg-muted"
												>
													<X className="h-3 w-3" />
												</button>
											</span>
										))}
									</div>
								) : (
									<div className="rounded-lg border border-dashed bg-muted/30 py-8 text-center">
										<p className="text-sm text-muted-foreground">
											No skills added yet. Start typing above to add your first
											skill.
										</p>
									</div>
								)}

								{/* Suggested Skills */}
								<div className="rounded-lg border bg-muted/50 p-4">
									<p className="mb-2 text-sm font-medium">
										Suggested skills (based on your experience):
									</p>
									<div className="flex flex-wrap gap-2">
										{[
											"Kubernetes",
											"GraphQL",
											"MongoDB",
											"Redis",
											"Terraform",
										].map((skill) => (
											<Button
												key={skill}
												variant="outline"
												size="sm"
												onClick={() => {
													if (!profile.skills.includes(skill)) {
														setProfile({
															...profile,
															skills: [...profile.skills, skill],
														});
													}
												}}
												disabled={profile.skills.includes(skill)}
											>
												<Plus className="mr-1 h-3 w-3" />
												{skill}
											</Button>
										))}
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Custom / Imported Sections */}
					{activeTab.startsWith("custom-") &&
						(() => {
							const section = customSections.find(
								(s) => `custom-${s.id}` === activeTab
							);
							if (!section) return null;

							return (
								<Card className="border-border/50 bg-card/80 backdrop-blur">
									<CardHeader className="flex flex-row items-center justify-between">
										<div>
											<CardTitle>{section.title}</CardTitle>
											<CardDescription>
												Imported from your resume or added manually. Edit or
												remove entries to keep your profile tidy.
											</CardDescription>
										</div>
										<Button
											variant="ghost"
											className="text-destructive"
											onClick={() => handleRemoveCustomSection(section.id)}
										>
											<Trash2 className="mr-2 h-4 w-4" />
											Remove section
										</Button>
									</CardHeader>
									<CardContent className="space-y-3">
										{section.entries.map((entry, index) => (
											<div
												key={`${section.id}-${entry.id}`}
												className="space-y-2 rounded-lg border bg-background/50 p-3"
											>
												<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
													<div className="flex-1">
														{/* <Label className="text-sm font-medium">
															Entry heading
														</Label> */}
														<Input
															className="mt-1"
															placeholder="e.g., Project title, Award name, Publication"
															value={entry.title}
															onChange={(e) =>
																handleUpdateCustomEntry(section.id, entry.id, {
																	title: e.target.value,
																})
															}
														/>
													</div>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive"
														onClick={() =>
															handleRemoveCustomEntry(section.id, index)
														}
														aria-label="Remove entry"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
												<Textarea
													value={entry.value}
													onChange={(e) =>
														handleUpdateCustomEntry(section.id, entry.id, {
															value: e.target.value,
														})
													}
													placeholder="Details, bullet points, or notes for this section..."
													rows={3}
												/>
											</div>
										))}

										<Button
											variant="outline"
											onClick={() => handleAddCustomEntry(section.id)}
											className="w-full sm:w-auto"
										>
											<Plus className="mr-2 h-4 w-4" />
											Add entry
										</Button>
									</CardContent>
								</Card>
							);
						})()}
				</motion.div>

				{/* Save Button */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className="mt-6 flex justify-end"
				>
					<Button onClick={handleSave} disabled={isSaving} size="lg">
						{isSaving ? (
							<>
								<span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								Saving...
							</>
						) : (
							<>
								<Save className="mr-2 h-4 w-4" />
								Save Changes
							</>
						)}
					</Button>
				</motion.div>
			</div>
		</div>
	);
}
