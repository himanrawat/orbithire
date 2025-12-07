"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
	Building2,
	Globe,
	Briefcase,
	FileText,
	ChevronLeft,
	Save,
	Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusOptions = [
	{ value: "saved", label: "Saved", description: "Saved for later" },
	{ value: "applied", label: "Applied", description: "Application submitted" },
	{
		value: "interviewing",
		label: "Interviewing",
		description: "In interview process",
	},
	{ value: "offered", label: "Offered", description: "Received an offer" },
	{ value: "rejected", label: "Rejected", description: "Application rejected" },
	{
		value: "withdrawn",
		label: "Withdrawn",
		description: "Withdrew application",
	},
];

const industryOptions = [
	"Technology",
	"Finance",
	"Healthcare",
	"Manufacturing",
	"Retail",
	"Consulting",
	"Education",
	"Media & Entertainment",
	"Telecommunications",
	"Energy",
	"Transportation",
	"Other",
];

export default function NewCompanyPage() {
	const router = useRouter();
	const [isSaving, setIsSaving] = useState(false);

	const [formData, setFormData] = useState({
		name: "",
		website: "",
		industry: "",
		status: "saved",
		notes: "",
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSaving(true);

		// TODO: Save to Supabase
		await new Promise((resolve) => setTimeout(resolve, 1000));

		setIsSaving(false);
		router.push("/companies");
	};

	const isValid = formData.name.trim().length > 0;

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
						<Link href="/companies">
							<ChevronLeft className="mr-1 h-4 w-4" />
							Back to Companies
						</Link>
					</Button>
					<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
						<Building2 className="h-8 w-8 text-primary" />
						New Company
					</h1>
					<p className="mt-1 text-muted-foreground">
						Add a new company to track your job applications.
					</p>
				</motion.div>

				{/* Form */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
				>
					<form onSubmit={handleSubmit}>
						<Card className="border-border/50 bg-card/80 backdrop-blur">
							<CardHeader>
								<CardTitle>Company Details</CardTitle>
								<CardDescription>
									Enter the company information to start tracking.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Company Name */}
								<div className="space-y-2">
									<Label htmlFor="name">
										<Building2 className="mr-2 inline h-4 w-4" />
										Company Name <span className="text-destructive">*</span>
									</Label>
									<Input
										id="name"
										placeholder="e.g., Google, Microsoft, SAP"
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										required
									/>
								</div>

								{/* Website */}
								<div className="space-y-2">
									<Label htmlFor="website">
										<Globe className="mr-2 inline h-4 w-4" />
										Website
									</Label>
									<Input
										id="website"
										type="url"
										placeholder="https://company.com"
										value={formData.website}
										onChange={(e) =>
											setFormData({ ...formData, website: e.target.value })
										}
									/>
								</div>

								{/* Industry */}
								<div className="space-y-2">
									<Label htmlFor="industry">
										<Briefcase className="mr-2 inline h-4 w-4" />
										Industry
									</Label>
									<select
										id="industry"
										value={formData.industry}
										onChange={(e) =>
											setFormData({ ...formData, industry: e.target.value })
										}
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									>
										<option value="">Select industry...</option>
										{industryOptions.map((industry) => (
											<option key={industry} value={industry}>
												{industry}
											</option>
										))}
									</select>
								</div>

								{/* Status */}
								<div className="space-y-3">
									<Label>
										<FileText className="mr-2 inline h-4 w-4" />
										Application Status
									</Label>
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
										{statusOptions.map((status) => (
											<button
												key={status.value}
												type="button"
												onClick={() =>
													setFormData({ ...formData, status: status.value })
												}
												className={cn(
													"flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:bg-accent",
													formData.status === status.value
														? "border-primary bg-primary/5"
														: "border-border"
												)}
											>
												<span className="text-sm font-medium">
													{status.label}
												</span>
												<span className="text-xs text-muted-foreground">
													{status.description}
												</span>
											</button>
										))}
									</div>
								</div>

								{/* Notes */}
								<div className="space-y-2">
									<Label htmlFor="notes">Notes</Label>
									<Textarea
										id="notes"
										rows={4}
										placeholder="Add any notes about this company, job role, or application..."
										value={formData.notes}
										onChange={(e) =>
											setFormData({ ...formData, notes: e.target.value })
										}
									/>
								</div>
							</CardContent>
						</Card>

						{/* Actions */}
						<div className="mt-6 flex items-center justify-end gap-3">
							<Button variant="outline" asChild>
								<Link href="/companies">Cancel</Link>
							</Button>
							<Button type="submit" disabled={!isValid || isSaving}>
								{isSaving ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Saving...
									</>
								) : (
									<>
										<Save className="mr-2 h-4 w-4" />
										Save Company
									</>
								)}
							</Button>
						</div>
					</form>
				</motion.div>
			</div>
		</div>
	);
}
