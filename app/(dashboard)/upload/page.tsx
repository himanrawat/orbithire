"use client";

import { useState, useRef, useCallback } from "react";
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
import { GridBackground } from "@/components/ui/aceternity";
import {
	Upload,
	FileText,
	ChevronLeft,
	Loader2,
	CheckCircle2,
	AlertCircle,
	X,
	File,
} from "lucide-react";
import { cn } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

type ParsedResume = {
	fullName?: string;
	email?: string;
	phone?: string;
	skills?: string[];
	experienceCount?: number;
	educationCount?: number;
};

export default function UploadPage() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [uploadState, setUploadState] = useState<UploadState>("idle");
	const [file, setFile] = useState<File | null>(null);
	const [dragActive, setDragActive] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [parsedData, setParsedData] = useState<ParsedResume | null>(null);

	const handleDrag = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.type === "dragenter" || e.type === "dragover") {
			setDragActive(true);
		} else if (e.type === "dragleave") {
			setDragActive(false);
		}
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		if (e.dataTransfer.files && e.dataTransfer.files[0]) {
			handleFile(e.dataTransfer.files[0]);
		}
	}, []);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.preventDefault();
		if (e.target.files && e.target.files[0]) {
			handleFile(e.target.files[0]);
		}
	};

	const handleFile = async (selectedFile: File) => {
		// Validate file type
		const validTypes = [
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		];
		if (!validTypes.includes(selectedFile.type)) {
			setError("Please upload a PDF or DOCX file.");
			return;
		}

		// Validate file size (max 5MB)
		if (selectedFile.size > 5 * 1024 * 1024) {
			setError("File size must be less than 5MB.");
			return;
		}

		setError(null);
		setFile(selectedFile);
		setUploadState("uploading");

		// Simulate upload
		await new Promise((resolve) => setTimeout(resolve, 1500));

		setUploadState("processing");

		// Simulate parsing
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// TODO: Actually parse the resume using API
		setParsedData({
			fullName: "Detected Name",
			email: "email@example.com",
			phone: "+1 234 567 890",
			skills: ["React", "TypeScript", "Node.js", "Python"],
			experienceCount: 3,
			educationCount: 2,
		});

		setUploadState("success");
	};

	const handleRemoveFile = () => {
		setFile(null);
		setUploadState("idle");
		setParsedData(null);
		setError(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleContinue = () => {
		// TODO: Save parsed data to profile
		router.push("/profile");
	};

	return (
		<div className="min-h-screen">
			<GridBackground />

			<div className="relative max-w-2xl px-6 py-8">
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
						<Upload className="h-8 w-8 text-primary" />
						Upload Resume
					</h1>
					<p className="mt-1 text-muted-foreground">
						Upload your existing resume and we'll extract your information to
						populate your profile.
					</p>
				</motion.div>

				{/* Upload Area */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
				>
					<Card className="border-border/50 bg-card/80 backdrop-blur">
						<CardHeader>
							<CardTitle>Upload Resume</CardTitle>
							<CardDescription>
								Supported formats: PDF, DOCX (max 5MB)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Drop Zone */}
							{uploadState === "idle" && (
								<div
									className={cn(
										"relative rounded-lg border-2 border-dashed p-12 text-center transition-colors",
										dragActive
											? "border-primary bg-primary/5"
											: "border-border hover:border-primary/50 hover:bg-accent/50",
										error && "border-destructive"
									)}
									onDragEnter={handleDrag}
									onDragLeave={handleDrag}
									onDragOver={handleDrag}
									onDrop={handleDrop}
								>
									<input
										ref={fileInputRef}
										type="file"
										accept=".pdf,.docx"
										onChange={handleChange}
										className="absolute inset-0 cursor-pointer opacity-0"
									/>
									<div className="flex flex-col items-center gap-4">
										<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
											<Upload className="h-8 w-8 text-primary" />
										</div>
										<div>
											<p className="text-lg font-medium">
												Drop your resume here
											</p>
											<p className="text-sm text-muted-foreground">
												or click to browse files
											</p>
										</div>
									</div>
								</div>
							)}

							{/* Uploading State */}
							{uploadState === "uploading" && (
								<div className="flex flex-col items-center gap-4 py-8">
									<Loader2 className="h-12 w-12 animate-spin text-primary" />
									<div className="text-center">
										<p className="font-medium">Uploading...</p>
										<p className="text-sm text-muted-foreground">
											{file?.name}
										</p>
									</div>
								</div>
							)}

							{/* Processing State */}
							{uploadState === "processing" && (
								<div className="flex flex-col items-center gap-4 py-8">
									<div className="relative">
										<Loader2 className="h-12 w-12 animate-spin text-primary" />
										<FileText className="absolute inset-0 m-auto h-6 w-6 text-primary" />
									</div>
									<div className="text-center">
										<p className="font-medium">Parsing resume...</p>
										<p className="text-sm text-muted-foreground">
											Extracting your information
										</p>
									</div>
								</div>
							)}

							{/* Success State */}
							{uploadState === "success" && parsedData && (
								<div className="space-y-6">
									{/* File Info */}
									<div className="flex items-center gap-4 rounded-lg border bg-accent/50 p-4">
										<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
											<File className="h-6 w-6 text-primary" />
										</div>
										<div className="flex-1">
											<p className="font-medium">{file?.name}</p>
											<p className="text-sm text-muted-foreground">
												{((file?.size || 0) / 1024).toFixed(1)} KB
											</p>
										</div>
										<Button
											variant="ghost"
											size="icon"
											onClick={handleRemoveFile}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>

									{/* Parsed Data Preview */}
									<div className="rounded-lg border bg-green-500/5 p-4">
										<div className="flex items-center gap-2 text-green-600 dark:text-green-400">
											<CheckCircle2 className="h-5 w-5" />
											<span className="font-medium">
												Resume parsed successfully!
											</span>
										</div>
										<div className="mt-4 grid gap-3 text-sm">
											{parsedData.fullName && (
												<div className="flex items-center gap-2">
													<span className="text-muted-foreground">Name:</span>
													<span>{parsedData.fullName}</span>
												</div>
											)}
											{parsedData.email && (
												<div className="flex items-center gap-2">
													<span className="text-muted-foreground">Email:</span>
													<span>{parsedData.email}</span>
												</div>
											)}
											{parsedData.skills && parsedData.skills.length > 0 && (
												<div className="flex items-center gap-2">
													<span className="text-muted-foreground">Skills:</span>
													<div className="flex flex-wrap gap-1">
														{parsedData.skills.slice(0, 5).map((skill) => (
															<span
																key={skill}
																className="rounded-full bg-primary/10 px-2 py-0.5 text-xs"
															>
																{skill}
															</span>
														))}
														{parsedData.skills.length > 5 && (
															<span className="text-xs text-muted-foreground">
																+{parsedData.skills.length - 5} more
															</span>
														)}
													</div>
												</div>
											)}
											{parsedData.experienceCount !== undefined && (
												<div className="flex items-center gap-2">
													<span className="text-muted-foreground">
														Work Experience:
													</span>
													<span>
														{parsedData.experienceCount} entries found
													</span>
												</div>
											)}
											{parsedData.educationCount !== undefined && (
												<div className="flex items-center gap-2">
													<span className="text-muted-foreground">
														Education:
													</span>
													<span>{parsedData.educationCount} entries found</span>
												</div>
											)}
										</div>
									</div>
								</div>
							)}

							{/* Error State */}
							{error && (
								<div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
									<AlertCircle className="h-5 w-5" />
									<span>{error}</span>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Actions */}
					<div className="mt-6 flex items-center justify-end gap-3">
						<Button variant="outline" asChild>
							<Link href="/dashboard">Cancel</Link>
						</Button>
						{uploadState === "success" && (
							<Button onClick={handleContinue}>
								Continue to Profile
								<ChevronLeft className="ml-1 h-4 w-4 rotate-180" />
							</Button>
						)}
					</div>
				</motion.div>
			</div>
		</div>
	);
}
