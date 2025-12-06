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
};

type Tab = "personal" | "experience" | "education" | "skills";

export default function ProfilePage() {
	const user = { name: "User", avatarUrl: undefined };
	const [activeTab, setActiveTab] = useState<Tab>("personal");
	const [profile, setProfile] = useState<ProfileData>(emptyProfile);
	const [isSaving, setIsSaving] = useState(false);
	const [newSkill, setNewSkill] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
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

	const handleSave = async () => {
		setIsSaving(true);
		// TODO: Call API to save profile
		await new Promise((resolve) => setTimeout(resolve, 1000));
		setIsSaving(false);
	};

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
					<div className="flex flex-wrap gap-2 rounded-lg border bg-card/80 p-2 backdrop-blur">
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
								<Button>
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
													<h4 className="font-medium">{exp.role}</h4>
													<p className="text-sm text-muted-foreground">
														{exp.company} · {exp.location}
													</p>
													<p className="text-xs text-muted-foreground">
														{exp.start_date} - {exp.end_date || "Present"}
													</p>
												</div>
												<div className="flex gap-1">
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
													>
														<FileText className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8 text-destructive"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</div>
											<div className="space-y-3">
												<div className="grid gap-4 sm:grid-cols-2">
													<div className="space-y-2">
														<Label>Job Title</Label>
														<Input defaultValue={exp.role} />
													</div>
													<div className="space-y-2">
														<Label>Company</Label>
														<Input defaultValue={exp.company} />
													</div>
													<div className="space-y-2">
														<Label>Location</Label>
														<Input defaultValue={exp.location} />
													</div>
													<div className="grid grid-cols-2 gap-2">
														<div className="space-y-2">
															<Label>Start</Label>
															<Input
																type="month"
																defaultValue={exp.start_date}
															/>
														</div>
														<div className="space-y-2">
															<Label>End</Label>
															<Input
																type="month"
																defaultValue={exp.end_date || ""}
																placeholder="Present"
															/>
														</div>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Description</Label>
													<Textarea
														rows={3}
														defaultValue={exp.description}
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
								<Button>
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
													<h4 className="font-medium">{edu.degree}</h4>
													<p className="text-sm text-muted-foreground">
														{edu.institution} · {edu.location}
													</p>
													<p className="text-xs text-muted-foreground">
														{edu.start_date} - {edu.end_date}
													</p>
												</div>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-destructive"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
											<div className="grid gap-4 sm:grid-cols-2">
												<div className="space-y-2">
													<Label>Degree</Label>
													<Input defaultValue={edu.degree} />
												</div>
												<div className="space-y-2">
													<Label>Institution</Label>
													<Input defaultValue={edu.institution} />
												</div>
												<div className="space-y-2">
													<Label>Location</Label>
													<Input defaultValue={edu.location} />
												</div>
												<div className="grid grid-cols-2 gap-2">
													<div className="space-y-2">
														<Label>Start</Label>
														<Input defaultValue={edu.start_date} />
													</div>
													<div className="space-y-2">
														<Label>End</Label>
														<Input defaultValue={edu.end_date} />
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
										<Button>
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
