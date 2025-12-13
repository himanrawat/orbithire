import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { serverEnv } from "@/lib/config";
import {
	RESUME_SYSTEM_PROMPT,
	buildResumePrompt,
	buildCoverLetterPrompt,
	COVER_LETTER_SYSTEM_PROMPT,
} from "@/lib/prompts/resume";

export const runtime = "nodejs";

interface GenerateRequest {
	jobTitle: string;
	jobDescription: string;
	companyName: string;
	recruiterName?: string;
	templateId: string;
	generateCoverLetter?: boolean;
}

/**
 * Get AI configuration from user settings, falling back to environment variables
 */
async function getAIConfig(
	supabase: ReturnType<typeof createServerClient>,
	userId: string
): Promise<{ apiKey: string; baseURL?: string; model: string } | null> {
	// First try to get user's saved settings
	const { data: settings } = await supabase
		.from("user_settings")
		.select("ai_provider, ai_api_key_encrypted, ai_base_url, ai_default_model")
		.eq("user_id", userId)
		.single();

	const provider = settings?.ai_provider || "groq";
	let apiKey = settings?.ai_api_key_encrypted || null;
	let baseURL = settings?.ai_base_url || undefined;
	let model = settings?.ai_default_model || null;

	// If user has their own key, use it
	if (apiKey) {
		if (provider === "groq" && !baseURL) {
			baseURL = "https://api.groq.com/openai/v1";
			model = model || "llama-3.1-70b-versatile";
		} else if (provider === "openai" && !baseURL) {
			baseURL = undefined; // OpenAI SDK uses default
			model = model || "gpt-4o-mini";
		}
		return { apiKey, baseURL, model: model || "llama-3.1-70b-versatile" };
	}

	// Fall back to environment variables
	if (provider === "groq" && process.env.GROQ_API_KEY) {
		return {
			apiKey: process.env.GROQ_API_KEY,
			baseURL: "https://api.groq.com/openai/v1",
			model: "llama-3.1-70b-versatile",
		};
	}

	if (process.env.OPENAI_API_KEY) {
		return {
			apiKey: process.env.OPENAI_API_KEY,
			baseURL: process.env.OPENAI_BASE_URL || undefined,
			model: "gpt-4o-mini",
		};
	}

	if (process.env.GROQ_API_KEY) {
		return {
			apiKey: process.env.GROQ_API_KEY,
			baseURL: "https://api.groq.com/openai/v1",
			model: "llama-3.1-70b-versatile",
		};
	}

	return null;
}

export async function POST(req: NextRequest) {
	// Authenticate user
	const supabase = createServerClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseAnonKey,
		{
			cookies: {
				get(name: string) {
					return req.cookies.get(name)?.value;
				},
				set() {},
				remove() {},
			},
		}
	);

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	}

	// Parse request body
	let body: GenerateRequest;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const {
		jobTitle,
		jobDescription,
		companyName,
		recruiterName,
		generateCoverLetter = true,
	} = body;

	if (!jobTitle || !jobDescription || !companyName) {
		return NextResponse.json(
			{ error: "jobTitle, jobDescription, and companyName are required" },
			{ status: 400 }
		);
	}

	// Fetch user profile
	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", user.id)
		.single();

	if (profileError || !profile) {
		return NextResponse.json(
			{ error: "Profile not found. Please complete your profile first." },
			{ status: 404 }
		);
	}

	// Parse extended profile data from extended_profile JSON
	let extendedData: {
		work_experience?: any[];
		education?: any[];
		custom_fields?: any[];
		customSections?: any[];
	} = {};

	if (profile.extended_profile) {
		if (typeof profile.extended_profile === "string") {
			try {
				extendedData = JSON.parse(profile.extended_profile);
			} catch (e) {
				console.warn("[generate/resume] Failed to parse extended_profile:", e);
			}
		} else if (typeof profile.extended_profile === "object") {
			extendedData = profile.extended_profile;
		}
	}

	// Use work experience from extended_profile JSON
	const workExperience = extendedData.work_experience || [];

	// Use education from extended_profile JSON
	const education = extendedData.education || [];

	// Use custom sections (e.g., Projects) from extended_profile JSON
	const customSections = extendedData.customSections || [];

	// Prepare profile for prompts
	const candidateProfile = {
		name: profile.full_name || "Candidate",
		email: profile.email || undefined,
		phone: profile.phone || undefined,
		location: profile.location || undefined,
		website: profile.portfolio_url || undefined,
		linkedin: profile.linkedin_url || undefined,
		headline: profile.headline || undefined,
		summary: profile.experience_summary || profile.bio || undefined,
		experience: workExperience.map((exp: any) => ({
			company: exp.company,
			title: exp.role || exp.title,
			startDate: exp.start_date,
			endDate: exp.end_date,
			highlights: exp.description
				? exp.description.split(/\n|•/).filter((s: string) => s.trim())
				: [],
		})),
		education: education.map((edu: any) => ({
			institution: edu.institution,
			degree: edu.degree || "Degree",
			field: edu.field || edu.area || edu.location || "",
			endDate: edu.end_date,
		})),
		skills: profile.skills || [],
		customSections: customSections.map((section: any) => ({
			title: section.title,
			entries: (section.entries || []).map((entry: any) => ({
				title: entry.title || "",
				description: entry.description || "",
			})),
		})),
	};

	// Get AI configuration from user settings or environment
	const aiConfig = await getAIConfig(supabase, user.id);

	if (!aiConfig) {
		return NextResponse.json(
			{
				error:
					"AI service not configured. Please add your API key in Settings.",
				needsSetup: true,
			},
			{ status: 400 }
		);
	}

	const openai = new OpenAI({
		apiKey: aiConfig.apiKey,
		baseURL: aiConfig.baseURL,
	});
	const model = aiConfig.model;

	try {
		// Generate resume content
		const resumePrompt = buildResumePrompt(
			candidateProfile,
			jobDescription,
			jobTitle,
			companyName
		);

		const resumeCompletion = await openai.chat.completions.create({
			model,
			messages: [
				{ role: "system", content: RESUME_SYSTEM_PROMPT },
				{ role: "user", content: resumePrompt },
			],
			temperature: 0.7,
			max_tokens: 2000,
		});

		const resumeContent = resumeCompletion.choices[0]?.message?.content || "";

		let resumeData: {
			label?: string;
			summary?: string;
			workHighlights?: Record<string, string[]>;
			skillsOrdered?: string[];
			customSectionHighlights?: Record<string, string[]>;
		} = {};

		try {
			// Try to parse JSON response
			const cleanedContent = resumeContent
				.replace(/```json\n?/g, "")
				.replace(/```\n?/g, "")
				.trim();
			resumeData = JSON.parse(cleanedContent);
		} catch {
			console.error("Failed to parse resume JSON:", resumeContent);
			resumeData = {
				summary: resumeContent,
				label: jobTitle,
			};
		}

		// Generate cover letter if requested
		let coverLetter = "";
		if (generateCoverLetter) {
			const topExperiences = candidateProfile.experience
				.flatMap((exp) => exp.highlights.slice(0, 2))
				.slice(0, 4);

			const coverLetterPrompt = buildCoverLetterPrompt(
				{
					...candidateProfile,
					topExperiences,
				},
				jobDescription,
				jobTitle,
				companyName,
				recruiterName
			);

			const coverLetterCompletion = await openai.chat.completions.create({
				model,
				messages: [
					{ role: "system", content: COVER_LETTER_SYSTEM_PROMPT },
					{ role: "user", content: coverLetterPrompt },
				],
				temperature: 0.7,
				max_tokens: 1000,
			});

			coverLetter = coverLetterCompletion.choices[0]?.message?.content || "";
		}

		return NextResponse.json({
			success: true,
			resume: {
				label: resumeData.label || jobTitle,
				summary: resumeData.summary || candidateProfile.summary,
				workHighlights: resumeData.workHighlights || {},
				skillsOrdered: resumeData.skillsOrdered || candidateProfile.skills,
				customSectionHighlights: resumeData.customSectionHighlights || {},
			},
			coverLetter,
			profile: {
				name: candidateProfile.name,
				email: profile.email,
				phone: profile.phone,
				location: profile.location,
				linkedin: profile.linkedin_url,
				website: profile.portfolio_url || profile.website,
				experience: candidateProfile.experience,
				education: candidateProfile.education,
				skills: candidateProfile.skills,
				customSections: candidateProfile.customSections,
			},
		});
	} catch (error) {
		console.error("AI generation error:", error);
		return NextResponse.json(
			{ error: "Failed to generate content. Please try again." },
			{ status: 500 }
		);
	}
}
