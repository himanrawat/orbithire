"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
	Sparkles,
	FileText,
	Building2,
	Globe2,
	Layout,
	ChevronLeft,
	ChevronRight,
	Check,
	Download,
	Eye,
	Share2,
	Copy,
	Loader2,
	AlertCircle,
	CheckCircle2,
	Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const countries = [
	{ code: "US", name: "United States", flag: "🇺🇸", requiresPhoto: false },
	{ code: "UK", name: "United Kingdom", flag: "🇬🇧", requiresPhoto: false },
	{ code: "DE", name: "Germany", flag: "🇩🇪", requiresPhoto: true },
	{ code: "NL", name: "Netherlands", flag: "🇳🇱", requiresPhoto: true },
	{ code: "FR", name: "France", flag: "🇫🇷", requiresPhoto: true },
	{ code: "AU", name: "Australia", flag: "🇦🇺", requiresPhoto: false },
	{ code: "CA", name: "Canada", flag: "🇨🇦", requiresPhoto: false },
	{ code: "IN", name: "India", flag: "🇮🇳", requiresPhoto: true },
];

const templates = [
	{
		id: "modern",
		name: "Modern",
		description: "Clean, contemporary design with accent colors",
		preview: "/templates/modern-preview.png",
	},
	{
		id: "classic",
		name: "Classic",
		description: "Traditional layout, professional and timeless",
		preview: "/templates/classic-preview.png",
	},
	{
		id: "minimal",
		name: "Minimal",
		description: "Simple and clean with focus on content",
		preview: "/templates/minimal-preview.png",
	},
	{
		id: "creative",
		name: "Creative",
		description: "Bold design for creative professionals",
		preview: "/templates/creative-preview.png",
	},
];

type Step = 1 | 2 | 3 | 4;

export default function GeneratePage() {
	const user = { name: "Himanshu", avatarUrl: undefined };
	const [step, setStep] = useState<Step>(1);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isGenerated, setIsGenerated] = useState(false);

	// Form state
	const [formData, setFormData] = useState({
		jobDescription: "",
		companyName: "",
		roleName: "",
		countryCode: "DE",
		templateId: "modern",
		generateCoverLetter: true,
	});

	// Extracted keywords (simulated)
	const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
	const [matchedSkills, setMatchedSkills] = useState<string[]>([]);

	const selectedCountry = countries.find(
		(c) => c.code === formData.countryCode
	);
	const selectedTemplate = templates.find((t) => t.id === formData.templateId);

	const steps = [
		{ id: 1, title: "Job Description" },
		{ id: 2, title: "Template & Country" },
		{ id: 3, title: "Review & Generate" },
		{ id: 4, title: "Download" },
	];

	const handleExtractKeywords = () => {
		// Simulated keyword extraction
		const keywords = [
			"React",
			"TypeScript",
			"Node.js",
			"AWS",
			"Agile",
			"REST APIs",
			"CI/CD",
		];
		const matched = ["React", "TypeScript", "Node.js", "AWS"];
		setExtractedKeywords(keywords);
		setMatchedSkills(matched);
	};

	const handleGenerate = async () => {
		setIsGenerating(true);
		// TODO: Call OpenAI API to generate resume
		await new Promise((resolve) => setTimeout(resolve, 3000));
		setIsGenerating(false);
		setIsGenerated(true);
		setStep(4);
	};

	const canProceed = () => {
		switch (step) {
			case 1:
				return (
					formData.jobDescription.length > 50 &&
					formData.companyName &&
					formData.roleName
				);
			case 2:
				return formData.countryCode && formData.templateId;
			case 3:
				return true;
			default:
				return true;
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
					<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
						<Sparkles className="h-8 w-8 text-primary" />
						Generate Resume
					</h1>
					<p className="mt-1 text-muted-foreground">
						Paste a job description and we'll tailor your resume with matching
						keywords.
					</p>
				</motion.div>

				{/* Progress Steps */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-8"
				>
					<div className="flex items-center justify-between">
						{steps.map((s, index) => (
							<div key={s.id} className="flex flex-1 items-center">
								<div className="flex items-center gap-2">
									<div
										className={cn(
											"flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
											step === s.id
												? "bg-primary text-primary-foreground"
												: step > s.id
												? "bg-primary/20 text-primary"
												: "bg-muted text-muted-foreground"
										)}
									>
										{step > s.id ? <Check className="h-4 w-4" /> : s.id}
									</div>
									<span
										className={cn(
											"hidden text-sm font-medium sm:block",
											step === s.id
												? "text-foreground"
												: "text-muted-foreground"
										)}
									>
										{s.title}
									</span>
								</div>
								{index < steps.length - 1 && (
									<div
										className={cn(
											"mx-4 h-0.5 flex-1",
											step > s.id ? "bg-primary" : "bg-muted"
										)}
									/>
								)}
							</div>
						))}
					</div>
				</motion.div>

				{/* Step Content */}
				<AnimatePresence mode="wait">
					{/* Step 1: Job Description */}
					{step === 1 && (
						<motion.div
							key="step1"
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -20 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<FileText className="h-5 w-5" />
										Job Details
									</CardTitle>
									<CardDescription>
										Paste the job description and provide company details.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="companyName">
												<Building2 className="mr-2 inline h-4 w-4" />
												Company Name
											</Label>
											<Input
												id="companyName"
												placeholder="e.g., Google, Siemens, SAP"
												value={formData.companyName}
												onChange={(e) =>
													setFormData({
														...formData,
														companyName: e.target.value,
													})
												}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="roleName">Role / Position</Label>
											<Input
												id="roleName"
												placeholder="e.g., Senior Frontend Engineer"
												value={formData.roleName}
												onChange={(e) =>
													setFormData({ ...formData, roleName: e.target.value })
												}
											/>
										</div>
									</div>

									<div className="space-y-2">
										<Label htmlFor="jobDescription">Job Description</Label>
										<Textarea
											id="jobDescription"
											rows={12}
											placeholder="Paste the full job description here..."
											value={formData.jobDescription}
											onChange={(e) => {
												setFormData({
													...formData,
													jobDescription: e.target.value,
												});
												if (e.target.value.length > 100) {
													handleExtractKeywords();
												}
											}}
											className="font-mono text-sm"
										/>
										<p className="text-xs text-muted-foreground">
											{formData.jobDescription.length} characters
											{formData.jobDescription.length < 50 && " (minimum 50)"}
										</p>
									</div>

									{/* Extracted Keywords */}
									{extractedKeywords.length > 0 && (
										<div className="rounded-lg border bg-muted/50 p-4">
											<p className="mb-2 text-sm font-medium">
												Extracted Keywords:
											</p>
											<div className="flex flex-wrap gap-2">
												{extractedKeywords.map((keyword) => (
													<span
														key={keyword}
														className={cn(
															"rounded-full px-2 py-1 text-xs font-medium",
															matchedSkills.includes(keyword)
																? "bg-green-500/10 text-green-600 dark:text-green-400"
																: "bg-orange-500/10 text-orange-600 dark:text-orange-400"
														)}
													>
														{matchedSkills.includes(keyword) && (
															<CheckCircle2 className="mr-1 inline h-3 w-3" />
														)}
														{!matchedSkills.includes(keyword) && (
															<AlertCircle className="mr-1 inline h-3 w-3" />
														)}
														{keyword}
													</span>
												))}
											</div>
											<p className="mt-2 text-xs text-muted-foreground">
												{matchedSkills.length} of {extractedKeywords.length}{" "}
												keywords match your profile
											</p>
										</div>
									)}

									{/* Cover Letter Option */}
									<div className="flex items-center gap-3">
										<input
											type="checkbox"
											id="generateCoverLetter"
											checked={formData.generateCoverLetter}
											onChange={(e) =>
												setFormData({
													...formData,
													generateCoverLetter: e.target.checked,
												})
											}
											className="h-4 w-4 rounded border-muted-foreground"
										/>
										<Label
											htmlFor="generateCoverLetter"
											className="cursor-pointer"
										>
											Also generate a cover letter
										</Label>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					)}

					{/* Step 2: Template & Country */}
					{step === 2 && (
						<motion.div
							key="step2"
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -20 }}
							className="space-y-6"
						>
							{/* Country Selection */}
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Globe2 className="h-5 w-5" />
										Target Country
									</CardTitle>
									<CardDescription>
										Resume format varies by country. We'll adjust sections
										accordingly.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
										{countries.map((country) => (
											<button
												key={country.code}
												onClick={() =>
													setFormData({
														...formData,
														countryCode: country.code,
													})
												}
												className={cn(
													"flex flex-col items-center rounded-lg border p-4 transition-colors",
													formData.countryCode === country.code
														? "border-primary bg-primary/5"
														: "border-border bg-background/50 hover:bg-muted/50"
												)}
											>
												<span className="mb-1 text-2xl">{country.flag}</span>
												<span className="text-sm font-medium">
													{country.code}
												</span>
												{country.requiresPhoto && (
													<span className="mt-1 text-xs text-muted-foreground">
														Photo req.
													</span>
												)}
											</button>
										))}
									</div>
									{selectedCountry?.requiresPhoto && (
										<p className="mt-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
											<AlertCircle className="h-4 w-4" />
											{selectedCountry.name} applications typically require a
											professional photo.
										</p>
									)}
								</CardContent>
							</Card>

							{/* Template Selection */}
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Layout className="h-5 w-5" />
										Resume Template
									</CardTitle>
									<CardDescription>
										Choose a layout that fits your style.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
										{templates.map((template) => (
											<button
												key={template.id}
												onClick={() =>
													setFormData({ ...formData, templateId: template.id })
												}
												className={cn(
													"flex flex-col overflow-hidden rounded-lg border transition-colors",
													formData.templateId === template.id
														? "border-primary ring-2 ring-primary/20"
														: "border-border hover:border-muted-foreground"
												)}
											>
												<div className="aspect-[3/4] bg-muted">
													{/* Template preview would go here */}
													<div className="flex h-full items-center justify-center">
														<FileText className="h-8 w-8 text-muted-foreground" />
													</div>
												</div>
												<div className="p-3 text-left">
													<p className="font-medium">{template.name}</p>
													<p className="text-xs text-muted-foreground">
														{template.description}
													</p>
												</div>
											</button>
										))}
									</div>
								</CardContent>
							</Card>
						</motion.div>
					)}

					{/* Step 3: Review & Generate */}
					{step === 3 && (
						<motion.div
							key="step3"
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -20 }}
						>
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Wand2 className="h-5 w-5" />
										Review & Generate
									</CardTitle>
									<CardDescription>
										Confirm your choices before generating.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-6">
									{/* Summary */}
									<div className="rounded-lg border bg-muted/50 p-4">
										<div className="grid gap-4 sm:grid-cols-2">
											<div>
												<p className="text-sm text-muted-foreground">Company</p>
												<p className="font-medium">{formData.companyName}</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">Role</p>
												<p className="font-medium">{formData.roleName}</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">Country</p>
												<p className="font-medium">
													{selectedCountry?.flag} {selectedCountry?.name}
												</p>
											</div>
											<div>
												<p className="text-sm text-muted-foreground">
													Template
												</p>
												<p className="font-medium">{selectedTemplate?.name}</p>
											</div>
										</div>
									</div>

									{/* What will be generated */}
									<div>
										<p className="mb-3 text-sm font-medium">Will generate:</p>
										<div className="space-y-2">
											<div className="flex items-center gap-2 text-sm">
												<CheckCircle2 className="h-4 w-4 text-green-500" />
												<span>
													Tailored resume for {formData.companyName} -{" "}
													{formData.roleName}
												</span>
											</div>
											{formData.generateCoverLetter && (
												<div className="flex items-center gap-2 text-sm">
													<CheckCircle2 className="h-4 w-4 text-green-500" />
													<span>
														Cover letter with company-specific introduction
													</span>
												</div>
											)}
											<div className="flex items-center gap-2 text-sm">
												<CheckCircle2 className="h-4 w-4 text-green-500" />
												<span>
													{matchedSkills.length} matching keywords highlighted
												</span>
											</div>
											{selectedCountry?.requiresPhoto && (
												<div className="flex items-center gap-2 text-sm">
													<CheckCircle2 className="h-4 w-4 text-green-500" />
													<span>Profile photo included (DE/EU format)</span>
												</div>
											)}
										</div>
									</div>

									{/* Generate Button */}
									<Button
										size="lg"
										className="w-full"
										onClick={handleGenerate}
										disabled={isGenerating}
									>
										{isGenerating ? (
											<>
												<Loader2 className="mr-2 h-5 w-5 animate-spin" />
												Generating with AI...
											</>
										) : (
											<>
												<Sparkles className="mr-2 h-5 w-5" />
												Generate Resume
												{formData.generateCoverLetter && " & Cover Letter"}
											</>
										)}
									</Button>
								</CardContent>
							</Card>
						</motion.div>
					)}

					{/* Step 4: Download */}
					{step === 4 && isGenerated && (
						<motion.div
							key="step4"
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -20 }}
							className="space-y-6"
						>
							{/* Success Message */}
							<Card className="border-green-500/20 bg-green-500/5 backdrop-blur">
								<CardContent className="flex items-center gap-4 p-6">
									<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
										<CheckCircle2 className="h-6 w-6 text-green-500" />
									</div>
									<div>
										<p className="font-medium text-green-600 dark:text-green-400">
											Documents Generated Successfully!
										</p>
										<p className="text-sm text-muted-foreground">
											Your resume
											{formData.generateCoverLetter && " and cover letter"}{" "}
											{formData.generateCoverLetter ? "are" : "is"} ready.
										</p>
									</div>
								</CardContent>
							</Card>

							{/* Generated Documents */}
							<div className="grid gap-4 sm:grid-cols-2">
								{/* Resume Card */}
								<Card className="border-border/50 bg-card/80 backdrop-blur">
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<FileText className="h-5 w-5" />
											Resume
										</CardTitle>
										<CardDescription>
											{formData.companyName} - {formData.roleName}
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="aspect-[3/4] rounded-lg border bg-muted">
											{/* Resume preview would go here */}
											<div className="flex h-full items-center justify-center">
												<FileText className="h-12 w-12 text-muted-foreground/50" />
											</div>
										</div>
										<div className="flex gap-2">
											<Button className="flex-1">
												<Download className="mr-2 h-4 w-4" />
												PDF
											</Button>
											<Button variant="outline" className="flex-1">
												<Download className="mr-2 h-4 w-4" />
												DOCX
											</Button>
										</div>
										<div className="flex gap-2">
											<Button variant="outline" size="sm" className="flex-1">
												<Eye className="mr-2 h-4 w-4" />
												Preview
											</Button>
											<Button variant="outline" size="sm" className="flex-1">
												<Share2 className="mr-2 h-4 w-4" />
												Share
											</Button>
										</div>
									</CardContent>
								</Card>

								{/* Cover Letter Card */}
								{formData.generateCoverLetter && (
									<Card className="border-border/50 bg-card/80 backdrop-blur">
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<FileText className="h-5 w-5" />
												Cover Letter
											</CardTitle>
											<CardDescription>
												{formData.companyName} - {formData.roleName}
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="aspect-[3/4] rounded-lg border bg-muted">
												{/* Cover letter preview would go here */}
												<div className="flex h-full items-center justify-center">
													<FileText className="h-12 w-12 text-muted-foreground/50" />
												</div>
											</div>
											<div className="flex gap-2">
												<Button className="flex-1">
													<Download className="mr-2 h-4 w-4" />
													PDF
												</Button>
												<Button variant="outline" className="flex-1">
													<Download className="mr-2 h-4 w-4" />
													DOCX
												</Button>
											</div>
											<div className="flex gap-2">
												<Button variant="outline" size="sm" className="flex-1">
													<Eye className="mr-2 h-4 w-4" />
													Preview
												</Button>
												<Button variant="outline" size="sm" className="flex-1">
													<Copy className="mr-2 h-4 w-4" />
													Copy Text
												</Button>
											</div>
										</CardContent>
									</Card>
								)}
							</div>

							{/* Next Actions */}
							<Card className="border-border/50 bg-card/80 backdrop-blur">
								<CardContent className="flex flex-wrap items-center gap-3 p-4">
									<Button variant="outline" asChild>
										<Link
											href={`/companies/${formData.companyName.toLowerCase()}`}
										>
											<Building2 className="mr-2 h-4 w-4" />
											Open Company Folder
										</Link>
									</Button>
									<Button variant="outline">
										<Sparkles className="mr-2 h-4 w-4" />
										Regenerate
									</Button>
									<Button variant="outline" asChild>
										<Link href="/generate">
											<Plus className="mr-2 h-4 w-4" />
											New Generation
										</Link>
									</Button>
								</CardContent>
							</Card>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Navigation */}
				{step < 4 && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
						className="mt-6 flex justify-between"
					>
						<Button
							variant="outline"
							onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
							disabled={step === 1}
						>
							<ChevronLeft className="mr-2 h-4 w-4" />
							Back
						</Button>
						<Button
							onClick={() => setStep((s) => (s < 3 ? ((s + 1) as Step) : s))}
							disabled={!canProceed() || step === 3}
						>
							Continue
							<ChevronRight className="ml-2 h-4 w-4" />
						</Button>
					</motion.div>
				)}
			</div>
		</div>
	);
}

function Plus(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			{...props}
		>
			<path d="M5 12h14" />
			<path d="M12 5v14" />
		</svg>
	);
}
