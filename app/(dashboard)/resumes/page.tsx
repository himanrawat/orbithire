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
} from "lucide-react";
import { useState } from "react";

// Data types
type Resume = {
	id: string;
	title: string;
	companyName: string | null;
	template: string;
	country: string;
	createdAt: string;
	updatedAt: string;
};

// Empty initial state - will be populated from Supabase
const resumes: Resume[] = [];

export default function ResumesPage() {
	const [searchQuery, setSearchQuery] = useState("");

	const filteredResumes = resumes.filter(
		(resume) =>
			resume.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			resume.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div className="min-h-screen">
			<GridBackground />

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
					{filteredResumes.length > 0 ? (
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
											<Button variant="ghost" size="icon">
												<Eye className="h-4 w-4" />
											</Button>
											<Button variant="ghost" size="icon">
												<Download className="h-4 w-4" />
											</Button>
											<Button variant="ghost" size="icon">
												<Trash2 className="h-4 w-4" />
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
