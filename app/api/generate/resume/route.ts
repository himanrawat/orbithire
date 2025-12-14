import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import OpenAI from "openai";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";
import {
	RESUME_SYSTEM_PROMPT,
	buildResumePrompt,
	buildCoverLetterPrompt,
	COVER_LETTER_SYSTEM_PROMPT,
} from "@/lib/prompts/resume";

export const runtime = "nodejs";

// Initialize R2 client for fetching profile photos
const r2Client =
	serverEnv.r2Endpoint &&
	serverEnv.r2Bucket &&
	serverEnv.r2AccessKeyId &&
	serverEnv.r2SecretAccessKey
		? new S3Client({
				region: "auto",
				endpoint: serverEnv.r2Endpoint,
				credentials: {
					accessKeyId: serverEnv.r2AccessKeyId,
					secretAccessKey: serverEnv.r2SecretAccessKey,
				},
		  })
		: null;

/**
 * Fetch profile photo from R2 and return as base64 data URL
 */
async function fetchPhotoAsBase64(
	avatarKey: string | null
): Promise<string | undefined> {
	if (!avatarKey || !r2Client || !serverEnv.r2Bucket) return undefined;

	// Skip if it's already a URL (legacy data)
	if (avatarKey.startsWith("http") || avatarKey.startsWith("data:")) {
		return avatarKey;
	}

	try {
		const response = await r2Client.send(
			new GetObjectCommand({
				Bucket: serverEnv.r2Bucket,
				Key: avatarKey,
			})
		);

		if (!response.Body) return undefined;

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);
		const contentType = response.ContentType || "image/jpeg";

		// Return as base64 data URL
		return `data:${contentType};base64,${buffer.toString("base64")}`;
	} catch (err) {
		console.error("Failed to fetch photo from R2:", err);
		return undefined;
	}
}

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

	// Prepare profile for prompts (matches ResumeProfile interface)
	const candidateProfile = {
		name: profile.full_name || "Candidate",
		email: profile.email || undefined,
		phone: profile.phone || undefined,
		location: profile.location || undefined,
		portfolio: profile.portfolio_url || undefined,
		linkedIn: profile.linkedin_url || undefined,
		headline: profile.headline || undefined,
		summary: profile.experience_summary || profile.bio || undefined,
		profilePhotoUrl: profile.avatar_url || undefined,
		experience: workExperience.map((exp: any) => ({
			company: exp.company,
			title: exp.role || exp.title,
			startDate: exp.start_date,
			endDate: exp.end_date,
			location: exp.location || undefined,
			highlights: exp.description
				? exp.description.split(/\n|•/).filter((s: string) => s.trim())
				: [],
		})),
		education: education.map((edu: any) => ({
			institution: edu.institution,
			degree: edu.degree || "Degree",
			field: edu.field || edu.area || edu.location || "",
			startDate: edu.start_date,
			endDate: edu.end_date,
		})),
		skills: profile.skills || [],
		certifications: profile.certifications || [],
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

	// Check if provider supports response_format (OpenAI does, Groq doesn't)
	const isOpenAICompatible = !aiConfig.baseURL?.includes("groq");

	try {
		// ============================================
		// PHASE 1: Generate resume with keyword extraction
		// ============================================
		const resumePrompt = buildResumePrompt(
			candidateProfile,
			jobDescription,
			jobTitle,
			companyName
		);

		const resumeCompletionParams: OpenAI.ChatCompletionCreateParams = {
			model,
			messages: [
				{ role: "system", content: RESUME_SYSTEM_PROMPT },
				{ role: "user", content: resumePrompt },
			],
			temperature: 0.3, // Lower for more consistent JSON
			max_tokens: 4500,
		};

		// LOG 1: Input structure going to AI
		console.log("=".repeat(80));
		console.log("📤 INPUT TO AI - Resume Generation");
		console.log("=".repeat(80));
		console.log("Model:", model);
		console.log("Temperature:", resumeCompletionParams.temperature);
		console.log("\n--- SYSTEM PROMPT (first 500 chars) ---");
		console.log(RESUME_SYSTEM_PROMPT.substring(0, 500) + "...");
		console.log("\n--- USER PROMPT (first 1000 chars) ---");
		console.log(resumePrompt.substring(0, 1000) + "...");
		console.log("\n--- CANDIDATE PROFILE STRUCTURE ---");
		console.log(JSON.stringify({
			name: candidateProfile.name,
			email: candidateProfile.email,
			experienceCount: candidateProfile.experience.length,
			educationCount: candidateProfile.education.length,
			skillsCount: candidateProfile.skills.length,
			customSectionsCount: candidateProfile.customSections.length,
			experience: candidateProfile.experience.map(exp => ({
				company: exp.company,
				title: exp.title,
				highlightsCount: exp.highlights.length
			})),
			skills: candidateProfile.skills,
		}, null, 2));
		console.log("=".repeat(80));

		// Only add response_format for OpenAI-compatible APIs (not Groq)
		if (isOpenAICompatible) {
			resumeCompletionParams.response_format = { type: "json_object" };
		}

		const resumeCompletion = await openai.chat.completions.create(
			resumeCompletionParams
		);
		const resumeContent = resumeCompletion.choices[0]?.message?.content || "";

		// LOG 2: Raw AI response
		console.log("\n" + "=".repeat(80));
		console.log("📥 RAW AI OUTPUT - Resume Generation");
		console.log("=".repeat(80));
		console.log("Response length:", resumeContent.length, "characters");
		console.log("\n--- FIRST 2000 CHARACTERS ---");
		console.log(resumeContent.substring(0, 2000));
		console.log("\n--- LAST 500 CHARACTERS ---");
		console.log(resumeContent.substring(Math.max(0, resumeContent.length - 500)));
		console.log("=".repeat(80));

		// Parse resume response with fallbacks
		let resumeData: {
			extractedKeywords?: string[];
			label?: string;
			summary?: string;
			workHighlights?: Record<string, string[]>;
			skillsOrdered?: string[];
			customSectionHighlights?: Record<string, string[]>;
		} = {};

		try {
			// Clean markdown fences if present
			const cleanedContent = resumeContent
				.replace(/```json\n?/gi, "")
				.replace(/```\n?/g, "")
				.trim();
			resumeData = JSON.parse(cleanedContent);

			// LOG 3: Successfully parsed AI output
			console.log("\n" + "=".repeat(80));
			console.log("✅ PARSED AI OUTPUT - Resume Data Structure");
			console.log("=".repeat(80));
			console.log(JSON.stringify({
				extractedKeywords: resumeData.extractedKeywords,
				label: resumeData.label,
				summary: resumeData.summary?.substring(0, 200) + "...",
				workHighlights: Object.keys(resumeData.workHighlights || {}).reduce((acc, company) => {
					acc[company] = {
						highlightsCount: resumeData.workHighlights?.[company]?.length || 0,
						firstHighlight: resumeData.workHighlights?.[company]?.[0]?.substring(0, 100) + "..."
					};
					return acc;
				}, {} as Record<string, any>),
				skillsOrdered: resumeData.skillsOrdered,
				customSectionHighlights: resumeData.customSectionHighlights
			}, null, 2));
			console.log("=".repeat(80));

			// Validate essential fields exist
			if (
				!resumeData.workHighlights ||
				typeof resumeData.workHighlights !== "object"
			) {
				console.warn("Missing workHighlights, building from profile");
				resumeData.workHighlights = {};
				for (const exp of candidateProfile.experience) {
					resumeData.workHighlights[exp.company] = exp.highlights;
				}
			}

			if (
				!resumeData.skillsOrdered ||
				!Array.isArray(resumeData.skillsOrdered)
			) {
				resumeData.skillsOrdered = candidateProfile.skills;
			}

			if (
				!resumeData.extractedKeywords ||
				!Array.isArray(resumeData.extractedKeywords)
			) {
				resumeData.extractedKeywords = [];
			}
		} catch (parseError: unknown) {
			const errorMessage =
				parseError instanceof Error
					? parseError.message
					: "Unknown parse error";
			console.error(
				"Failed to parse resume JSON:",
				errorMessage,
				resumeContent
			);

			// Build complete fallback from profile data
			const fallbackHighlights: Record<string, string[]> = {};
			for (const exp of candidateProfile.experience) {
				fallbackHighlights[exp.company] = exp.highlights;
			}

			resumeData = {
				extractedKeywords: [],
				summary: candidateProfile.summary || "",
				label: jobTitle,
				workHighlights: fallbackHighlights,
				skillsOrdered: candidateProfile.skills,
				customSectionHighlights: {},
			};
		}

		// ============================================
		// PHASE 2: Generate cover letter with extracted keywords
		// ============================================
		let coverLetter = "";
		if (generateCoverLetter) {
			const topExperiences = candidateProfile.experience
				.flatMap((exp) => exp.highlights.slice(0, 2))
				.slice(0, 4);

			// Pass extracted keywords to cover letter for consistent terminology
			const coverLetterPrompt = buildCoverLetterPrompt(
				{
					...candidateProfile,
					topExperiences,
				},
				jobDescription,
				jobTitle,
				companyName,
				recruiterName,
				{ extractedKeywords: resumeData.extractedKeywords || [] }
			);

			const coverLetterCompletion = await openai.chat.completions.create({
				model,
				messages: [
					{ role: "system", content: COVER_LETTER_SYSTEM_PROMPT },
					{ role: "user", content: coverLetterPrompt },
				],
				temperature: 0.5, // Slightly lower for more focused prose
				max_tokens: 1200,
			});

			coverLetter = coverLetterCompletion.choices[0]?.message?.content || "";

			// Clean any markdown formatting from cover letter
			coverLetter = coverLetter
				.replace(/^```[a-z]*\n?/i, "")
				.replace(/\n?```$/i, "")
				.trim();
		}

		// Fetch profile photo as base64 for embedding in resume HTML
		const imageBase64 = await fetchPhotoAsBase64(profile.avatar_url);

		return NextResponse.json({
			success: true,
			resume: {
				extractedKeywords: resumeData.extractedKeywords || [],
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
				website: profile.portfolio_url,
				image: imageBase64,
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
