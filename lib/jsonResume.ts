/**
 * Utility to convert user profile data to JSONResume format
 */

import type { JSONResume } from "./sampleResume";

export interface ProfileData {
	id: string;
	full_name: string;
	email: string;
	phone: string;
	location: string;
	bio: string;
	website: string;
	linkedin_url: string;
	github_url: string;
	avatar_url: string | null;
	skills: string[];
	work_experience: {
		id: string;
		company: string;
		role: string;
		location: string;
		start_date: string;
		end_date: string | null;
		description: string;
	}[];
	education: {
		id: string;
		institution: string;
		degree: string;
		location: string;
		start_date: string;
		end_date: string;
	}[];
	custom_fields?: { id: string; label: string; value: string }[];
}

/**
 * Convert profile data to JSONResume format
 */
export function profileToJSONResume(profile: ProfileData): JSONResume {
	const profiles: JSONResume["basics"]["profiles"] = [];

	if (profile.linkedin_url) {
		profiles.push({
			network: "LinkedIn",
			username: extractUsername(profile.linkedin_url),
			url: profile.linkedin_url,
		});
	}

	if (profile.github_url) {
		profiles.push({
			network: "GitHub",
			username: extractUsername(profile.github_url),
			url: profile.github_url,
		});
	}

	return {
		basics: {
			name: profile.full_name || "",
			label: "", // Will be set by AI based on job
			image: profile.avatar_url || undefined,
			email: profile.email || "",
			phone: profile.phone || "",
			url: profile.website || undefined,
			summary: profile.bio || "",
			location: {
				city: profile.location || "",
				countryCode: "US",
			},
			profiles,
		},
		work: profile.work_experience.map((exp) => ({
			name: exp.company,
			position: exp.role,
			startDate: formatDate(exp.start_date),
			endDate: exp.end_date ? formatDate(exp.end_date) : undefined,
			summary: "",
			highlights: parseHighlights(exp.description),
		})),
		education: profile.education.map((edu) => ({
			institution: edu.institution,
			area: extractArea(edu.degree),
			studyType: extractStudyType(edu.degree),
			startDate: formatDate(edu.start_date),
			endDate: edu.end_date ? formatDate(edu.end_date) : undefined,
		})),
		skills: groupSkills(profile.skills),
	};
}

function extractUsername(url: string): string {
	try {
		const parsed = new URL(url);
		const parts = parsed.pathname.split("/").filter(Boolean);
		return parts[parts.length - 1] || "";
	} catch {
		return url;
	}
}

function formatDate(dateStr: string): string {
	if (!dateStr) return "";
	// Convert from YYYY-MM-DD to YYYY-MM
	const parts = dateStr.split("-");
	if (parts.length >= 2) {
		return `${parts[0]}-${parts[1]}`;
	}
	return dateStr;
}

function parseHighlights(description: string): string[] {
	if (!description) return [];
	// Split by newlines or bullet points
	return description
		.split(/\n|•|▪|★|-\s/)
		.map((line) => line.trim())
		.filter((line) => line.length > 5);
}

function extractArea(degree: string): string {
	// Extract field of study from degree string
	// e.g., "Bachelor of Science in Computer Science" -> "Computer Science"
	const inMatch = degree.match(/\bin\s+(.+)$/i);
	if (inMatch) return inMatch[1].trim();

	const ofMatch = degree.match(/\bof\s+(.+)$/i);
	if (ofMatch) return ofMatch[1].trim();

	return degree;
}

function extractStudyType(degree: string): string {
	// Extract degree type
	const patterns: Record<string, string[]> = {
		"Bachelor of Science": [
			"bs",
			"b.s.",
			"bsc",
			"b.sc.",
			"bachelor of science",
		],
		"Bachelor of Arts": ["ba", "b.a.", "bachelor of arts"],
		"Master of Science": ["ms", "m.s.", "msc", "m.sc.", "master of science"],
		"Master of Arts": ["ma", "m.a.", "master of arts"],
		"Master of Business Administration": ["mba", "m.b.a."],
		PhD: ["phd", "ph.d.", "doctorate", "doctor of philosophy"],
		Associate: ["associate", "aa", "as"],
	};

	const lower = degree.toLowerCase();
	for (const [studyType, keywords] of Object.entries(patterns)) {
		if (keywords.some((kw) => lower.includes(kw))) {
			return studyType;
		}
	}

	return degree.split(" ").slice(0, 2).join(" ");
}

function groupSkills(skills: string[]): JSONResume["skills"] {
	// Group skills into categories
	const frontend = [
		"react",
		"vue",
		"angular",
		"next.js",
		"nextjs",
		"typescript",
		"javascript",
		"html",
		"css",
		"tailwind",
		"sass",
		"redux",
	];
	const backend = [
		"node",
		"python",
		"java",
		"go",
		"rust",
		"ruby",
		"php",
		"django",
		"flask",
		"express",
		"fastapi",
		"spring",
	];
	const database = [
		"postgresql",
		"mysql",
		"mongodb",
		"redis",
		"elasticsearch",
		"supabase",
		"firebase",
		"sql",
		"nosql",
	];
	const devops = [
		"aws",
		"gcp",
		"azure",
		"docker",
		"kubernetes",
		"terraform",
		"ci/cd",
		"jenkins",
		"github actions",
	];

	const categories: Record<string, string[]> = {
		Frontend: [],
		Backend: [],
		Database: [],
		DevOps: [],
		Other: [],
	};

	for (const skill of skills) {
		const lower = skill.toLowerCase();
		if (frontend.some((f) => lower.includes(f))) {
			categories.Frontend.push(skill);
		} else if (backend.some((b) => lower.includes(b))) {
			categories.Backend.push(skill);
		} else if (database.some((d) => lower.includes(d))) {
			categories.Database.push(skill);
		} else if (devops.some((d) => lower.includes(d))) {
			categories.DevOps.push(skill);
		} else {
			categories.Other.push(skill);
		}
	}

	return Object.entries(categories)
		.filter(([_, keywords]) => keywords.length > 0)
		.map(([name, keywords]) => ({
			name,
			keywords,
		}));
}

/**
 * Merge AI-generated content into a JSONResume structure
 */
export function mergeAIContent(
	baseResume: JSONResume,
	aiContent: {
		summary?: string;
		label?: string;
		workHighlights?: Record<string, string[]>;
		skillsReordered?: string[];
	}
): JSONResume {
	const merged = { ...baseResume };

	if (aiContent.summary) {
		merged.basics = { ...merged.basics, summary: aiContent.summary };
	}

	if (aiContent.label) {
		merged.basics = { ...merged.basics, label: aiContent.label };
	}

	if (aiContent.workHighlights) {
		merged.work = merged.work.map((job) => ({
			...job,
			highlights: aiContent.workHighlights?.[job.name] || job.highlights,
		}));
	}

	return merged;
}
