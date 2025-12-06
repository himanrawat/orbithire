"use client";

import { useState, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
	FileText,
	Briefcase,
	ArrowRight,
	ArrowLeft,
	Upload,
	CheckCircle2,
	Camera,
	Loader2,
	Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
	{ id: 1, title: "Profile", icon: User },
	{ id: 2, title: "Resume", icon: FileText },
	{ id: 3, title: "Preferences", icon: Briefcase },
];

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"];

interface ProfileData {
	fullName: string;
	headline: string;
	phone: string;
	location: string;
	linkedIn: string;
	portfolio: string;
	profilePhoto: string | null;
}

interface ResumeData {
	resumeFile: File | null;
	resumeFileName: string;
	skills: string;
	experience: string;
	education: string;
}

interface PreferencesData {
	jobTitles: string;
	locations: string;
	workType: string;
	salaryRange: string;
	startDate: string;
}

export default function OnboardingPage() {
	const router = useRouter();
	const [currentStep, setCurrentStep] = useState(1);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const photoInputRef = useRef<HTMLInputElement>(null);

	const [profileData, setProfileData] = useState<ProfileData>({
		fullName: "",
		headline: "",
		phone: "",
		location: "",
		linkedIn: "",
		portfolio: "",
		profilePhoto: null,
	});

	const [resumeData, setResumeData] = useState<ResumeData>({
		resumeFile: null,
		resumeFileName: "",
		skills: "",
		experience: "",
		education: "",
	});

	const [preferencesData, setPreferencesData] = useState<PreferencesData>({
		jobTitles: "",
		locations: "",
		workType: "hybrid",
		salaryRange: "",
		startDate: "immediately",
	});

	const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onloadend = () => {
				setProfileData((prev) => ({
					...prev,
					profilePhoto: reader.result as string,
				}));
			};
			reader.readAsDataURL(file);
		}
	};

	const handleResumeUpload = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			if (file.size > MAX_RESUME_BYTES) {
				setErrorMessage("Resume must be 5MB or smaller.");
				e.target.value = "";
				return;
			}

			const lowerName = file.name.toLowerCase();
			const hasValidExtension = RESUME_EXTENSIONS.some((ext) =>
				lowerName.endsWith(ext)
			);

			if (!hasValidExtension) {
				setErrorMessage("Use PDF, DOC, or DOCX for your resume.");
				e.target.value = "";
				return;
			}

			setErrorMessage(null);
			setResumeData((prev) => ({
				...prev,
				resumeFile: file,
				resumeFileName: file.name,
			}));
		}
	};

	const nextStep = () => {
		if (currentStep < 3) {
			setCurrentStep((prev) => prev + 1);
		}
	};

	const prevStep = () => {
		if (currentStep > 1) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const handleComplete = async () => {
		setErrorMessage(null);
		setIsSubmitting(true);

		const resumeFile = resumeData.resumeFile
			? {
					name: resumeData.resumeFile.name,
					size: resumeData.resumeFile.size,
					type: resumeData.resumeFile.type,
			  }
			: undefined;

		const payload = {
			profile: {
				fullName: profileData.fullName.trim(),
				headline: profileData.headline.trim(),
				location: profileData.location.trim(),
			},
			resume: {
				skills: resumeData.skills,
				experience: resumeData.experience,
				education: resumeData.education,
				file: resumeFile,
			},
			preferences: preferencesData,
		};

		try {
			const response = await fetch("/api/onboarding", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const body = await response.json().catch(() => ({}));
				setErrorMessage(
					body.error || "Unable to complete setup. Please try again."
				);
				setIsSubmitting(false);
				return;
			}

			router.push("/dashboard");
		} catch (error) {
			setErrorMessage(
				"Unable to complete setup right now. Please try again."
			);
			setIsSubmitting(false);
		}
	};

	const canProceed = () => {
		switch (currentStep) {
			case 1:
				return profileData.fullName.trim().length > 0;
			case 2:
				return true; // Resume is optional
			case 3:
				return true; // Preferences are optional
			default:
				return false;
		}
	};

	return (
		<div className="min-h-screen">
			<GridBackground />

			{/* Header */}
			<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="container flex h-14 items-center justify-between">
					<div className="flex items-center space-x-2">
						<Rocket className="h-5 w-5" />
						<span className="font-bold text-lg">OrbitHire</span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => router.push("/dashboard")}
					>
						Skip for now
					</Button>
				</div>
			</header>

			<div className="container relative px-4 py-8 md:py-12">
				{/* Progress Steps */}
				<div className="mx-auto mb-8 max-w-2xl">
					<div className="flex items-center justify-between">
						{steps.map((step, index) => (
							<div key={step.id} className="flex items-center">
								<div className="flex flex-col items-center">
									<motion.div
										initial={false}
										animate={{
											scale: currentStep === step.id ? 1.1 : 1,
											backgroundColor:
												currentStep >= step.id
													? "hsl(var(--primary))"
													: "hsl(var(--muted))",
										}}
										className={cn(
											"flex h-10 w-10 items-center justify-center rounded-full transition-colors",
											currentStep >= step.id
												? "text-primary-foreground"
												: "text-muted-foreground"
										)}
									>
										{currentStep > step.id ? (
											<CheckCircle2 className="h-5 w-5" />
										) : (
											<step.icon className="h-5 w-5" />
										)}
									</motion.div>
									<span
										className={cn(
											"mt-2 text-xs font-medium",
											currentStep >= step.id
												? "text-foreground"
												: "text-muted-foreground"
										)}
									>
										{step.title}
									</span>
								</div>
								{index < steps.length - 1 && (
									<div
										className={cn(
											"mx-4 h-0.5 w-16 sm:w-24 md:w-32",
											currentStep > step.id ? "bg-primary" : "bg-muted"
										)}
									/>
								)}
							</div>
						))}
					</div>
				</div>

				{errorMessage && (
					<div className="mx-auto mb-6 max-w-2xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
						{errorMessage}
					</div>
				)}

				{/* Step Content */}
				<div className="mx-auto max-w-2xl">
					<AnimatePresence mode="wait">
						{/* Step 1: Profile */}
						{currentStep === 1 && (
							<motion.div
								key="profile"
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -20 }}
								transition={{ duration: 0.3 }}
							>
								<Card className="border-border/50 bg-card/80 backdrop-blur">
									<CardHeader>
										<CardTitle className="text-2xl">
											Set up your profile
										</CardTitle>
										<CardDescription>
											Let's get to know you better. This helps us personalize
											your experience.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-6">
										{/* Profile Photo */}
										<div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-x-6 sm:space-y-0">
											<div className="relative">
												<div
													className={cn(
														"flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed",
														profileData.profilePhoto
															? "border-primary"
															: "border-muted-foreground/30"
													)}
												>
													{profileData.profilePhoto ? (
														<img
															src={profileData.profilePhoto}
															alt="Profile"
															className="h-full w-full object-cover"
														/>
													) : (
														<User className="h-10 w-10 text-muted-foreground" />
													)}
												</div>
												<button
													type="button"
													onClick={() => photoInputRef.current?.click()}
													className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted"
												>
													<Camera className="h-4 w-4" />
												</button>
												<input
													ref={photoInputRef}
													type="file"
													accept="image/*"
													onChange={handlePhotoUpload}
													className="hidden"
												/>
											</div>
											<div className="text-center sm:text-left">
												<p className="text-sm font-medium">Profile photo</p>
												<p className="text-xs text-muted-foreground">
													Upload a professional photo for your resume
												</p>
											</div>
										</div>

										<div className="grid gap-4 sm:grid-cols-2">
											<div className="space-y-2 sm:col-span-2">
												<Label htmlFor="fullName">Full name *</Label>
												<Input
													id="fullName"
													placeholder="John Doe"
													value={profileData.fullName}
													onChange={(e) =>
														setProfileData((prev) => ({
															...prev,
															fullName: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2 sm:col-span-2">
												<Label htmlFor="headline">Professional headline</Label>
												<Input
													id="headline"
													placeholder="Senior Software Engineer at Google"
													value={profileData.headline}
													onChange={(e) =>
														setProfileData((prev) => ({
															...prev,
															headline: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="phone">Phone number</Label>
												<Input
													id="phone"
													type="tel"
													placeholder="+1 (555) 000-0000"
													value={profileData.phone}
													onChange={(e) =>
														setProfileData((prev) => ({
															...prev,
															phone: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="location">Location</Label>
												<Input
													id="location"
													placeholder="San Francisco, CA"
													value={profileData.location}
													onChange={(e) =>
														setProfileData((prev) => ({
															...prev,
															location: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="linkedIn">LinkedIn URL</Label>
												<Input
													id="linkedIn"
													type="url"
													placeholder="https://linkedin.com/in/..."
													value={profileData.linkedIn}
													onChange={(e) =>
														setProfileData((prev) => ({
															...prev,
															linkedIn: e.target.value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="portfolio">Portfolio URL</Label>
												<Input
													id="portfolio"
													type="url"
													placeholder="https://yoursite.com"
													value={profileData.portfolio}
													onChange={(e) =>
														setProfileData((prev) => ({
															...prev,
															portfolio: e.target.value,
														}))
													}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</motion.div>
						)}

						{/* Step 2: Resume */}
						{currentStep === 2 && (
							<motion.div
								key="resume"
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -20 }}
								transition={{ duration: 0.3 }}
							>
								<Card className="border-border/50 bg-card/80 backdrop-blur">
									<CardHeader>
										<CardTitle className="text-2xl">
											Upload your resume
										</CardTitle>
										<CardDescription>
											We'll use this as a base to generate tailored resumes for
											each job.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-6">
										{/* Resume Upload */}
										<div
											role="button"
											tabIndex={0}
											aria-label="Upload your resume"
											onClick={() => fileInputRef.current?.click()}
											onKeyDown={(event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													fileInputRef.current?.click();
												}
											}}
											className={cn(
												"flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
												resumeData.resumeFile
													? "border-primary bg-primary/5"
													: "border-muted-foreground/30"
											)}
										>
											{resumeData.resumeFile ? (
												<>
													<FileText className="mb-3 h-12 w-12 text-primary" />
													<p className="font-medium">
														{resumeData.resumeFileName}
													</p>
													<p className="mt-1 text-sm text-muted-foreground">
														Click to replace
													</p>
												</>
											) : (
												<>
													<Upload className="mb-3 h-12 w-12 text-muted-foreground" />
													<p className="font-medium">Upload your resume</p>
													<p className="mt-1 text-sm text-muted-foreground">
														PDF, DOC, or DOCX (max 5MB)
													</p>
												</>
											)}
											<input
												ref={fileInputRef}
												type="file"
												accept=".pdf,.doc,.docx"
												onChange={handleResumeUpload}
												className="hidden"
											/>
										</div>

										<div className="relative">
											<div className="absolute inset-0 flex items-center">
												<span className="w-full border-t" />
											</div>
											<div className="relative flex justify-center text-xs uppercase">
												<span className="bg-card px-2 text-muted-foreground">
													Or add details manually
												</span>
											</div>
										</div>

										<div className="space-y-4">
											<div className="space-y-2">
												<Label htmlFor="skills">Key skills</Label>
												<Textarea
													id="skills"
													placeholder="React, TypeScript, Node.js, AWS, Python..."
													value={resumeData.skills}
													onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
														setResumeData((prev) => ({
															...prev,
															skills: e.target.value,
														}))
													}
													rows={2}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="experience">
													Work experience summary
												</Label>
												<Textarea
													id="experience"
													placeholder="Brief summary of your recent work experience..."
													value={resumeData.experience}
													onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
														setResumeData((prev) => ({
															...prev,
															experience: e.target.value,
														}))
													}
													rows={3}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="education">Education</Label>
												<Textarea
													id="education"
													placeholder="Your educational background..."
													value={resumeData.education}
													onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
														setResumeData((prev) => ({
															...prev,
															education: e.target.value,
														}))
													}
													rows={2}
												/>
											</div>
										</div>
									</CardContent>
								</Card>
							</motion.div>
						)}

						{/* Step 3: Preferences */}
						{currentStep === 3 && (
							<motion.div
								key="preferences"
								initial={{ opacity: 0, x: 20 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -20 }}
								transition={{ duration: 0.3 }}
							>
								<Card className="border-border/50 bg-card/80 backdrop-blur">
									<CardHeader>
										<CardTitle className="text-2xl">Job preferences</CardTitle>
										<CardDescription>
											Help us understand what you're looking for in your next
											role.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-6">
										<div className="space-y-2">
											<Label htmlFor="jobTitles">Target job titles</Label>
											<Input
												id="jobTitles"
												placeholder="Software Engineer, Frontend Developer, Full Stack..."
												value={preferencesData.jobTitles}
												onChange={(e) =>
													setPreferencesData((prev) => ({
														...prev,
														jobTitles: e.target.value,
													}))
												}
											/>
											<p className="text-xs text-muted-foreground">
												Separate multiple titles with commas
											</p>
										</div>

										<div className="space-y-2">
											<Label htmlFor="locations">Preferred locations</Label>
											<Input
												id="locations"
												placeholder="Remote, San Francisco, New York..."
												value={preferencesData.locations}
												onChange={(e) =>
													setPreferencesData((prev) => ({
														...prev,
														locations: e.target.value,
													}))
												}
											/>
										</div>

										<div className="space-y-2">
											<Label>Work type</Label>
											<div className="grid grid-cols-3 gap-3">
												{["remote", "hybrid", "onsite"].map((type) => (
													<button
														key={type}
														type="button"
														onClick={() =>
															setPreferencesData((prev) => ({
																...prev,
																workType: type,
															}))
														}
														className={cn(
															"rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors",
															preferencesData.workType === type
																? "border-primary bg-primary text-primary-foreground"
																: "border-input bg-background hover:bg-muted"
														)}
													>
														{type}
													</button>
												))}
											</div>
										</div>

										<div className="space-y-2">
											<Label htmlFor="salaryRange">Expected salary range</Label>
											<Input
												id="salaryRange"
												placeholder="$100,000 - $150,000"
												value={preferencesData.salaryRange}
												onChange={(e) =>
													setPreferencesData((prev) => ({
														...prev,
														salaryRange: e.target.value,
													}))
												}
											/>
										</div>

										<div className="space-y-2">
											<Label>When can you start?</Label>
											<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
												{[
													{ value: "immediately", label: "Immediately" },
													{ value: "2weeks", label: "2 weeks" },
													{ value: "1month", label: "1 month" },
													{ value: "flexible", label: "Flexible" },
												].map((option) => (
													<button
														key={option.value}
														type="button"
														onClick={() =>
															setPreferencesData((prev) => ({
																...prev,
																startDate: option.value,
															}))
														}
														className={cn(
															"rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
															preferencesData.startDate === option.value
																? "border-primary bg-primary text-primary-foreground"
																: "border-input bg-background hover:bg-muted"
														)}
													>
														{option.label}
													</button>
												))}
											</div>
										</div>
									</CardContent>
								</Card>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Navigation Buttons */}
					<div className="mt-6 flex items-center justify-between">
						<Button
							variant="ghost"
							onClick={prevStep}
							disabled={currentStep === 1}
							className={cn(currentStep === 1 && "invisible")}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back
						</Button>

						{currentStep < 3 ? (
							<Button onClick={nextStep} disabled={!canProceed()}>
								Continue
								<ArrowRight className="ml-2 h-4 w-4" />
							</Button>
						) : (
							<Button onClick={handleComplete} disabled={isSubmitting}>
								{isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Setting up...
									</>
								) : (
									<>
										Complete setup
										<CheckCircle2 className="ml-2 h-4 w-4" />
									</>
								)}
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
