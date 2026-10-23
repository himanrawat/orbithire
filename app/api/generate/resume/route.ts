import { NextResponse, type NextRequest } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";
import {
	RESUME_SYSTEM_PROMPT,
	buildResumePrompt,
	buildCoverLetterPrompt,
	COVER_LETTER_SYSTEM_PROMPT,
} from "@/lib/prompts/resume";
import { createProvider } from "@/lib/ai/providerFactory";
import { ProviderError, ProviderErrorType, type ProviderInitConfig } from "@/lib/ai/providers/baseProvider";
import { decryptApiKey } from "@/lib/encryption";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { z } from "zod";
import { parseJson } from "@/lib/api";
import { logAiGenerations, type AiGenerationEntry } from "@/lib/ai/generations/log";

export const runtime = "nodejs";
// Reads the session from req.cookies, which does not opt out of Next's fetch cache:
// without this, Supabase reads and upserts were served from .next/cache (stale data, lost saves).
export const fetchCache = "force-no-store";

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
	if (
		avatarKey.startsWith("http") ||
		avatarKey.startsWith("data:") ||
		avatarKey.startsWith("/api/profile/photo")
	) {
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

const generateSchema = z.object({
	jobTitle: z.string().trim().min(1).max(200),
	jobDescription: z.string().trim().min(1).max(30_000),
	companyName: z.string().trim().min(1).max(200),
	recruiterName: z.string().trim().max(200).optional(),
	recruiterEmail: z.string().trim().email().max(254).optional(),
	contactEmail: z.string().trim().email().max(254).optional(),
	templateId: z.string().trim().min(1).max(100),
	generateCoverLetter: z.boolean().optional(),
}).strict();

type ResumePromptProfile = Parameters<typeof buildResumePrompt>[0];
type CandidateProfile = ResumePromptProfile & {
	customSections: NonNullable<ResumePromptProfile["customSections"]>;
};
type ResumeData = {
	extractedKeywords?: string[];
	label?: string;
	summary?: string;
	workHighlights?: Record<string, string[]>;
	skillsOrdered?: string[];
	customSectionHighlights?: Record<string, string[]>;
};

type ProfileRecord = {
	full_name: string | null;
	email: string | null;
	phone: string | null;
	location: string | null;
	portfolio_url: string | null;
	linkedin_url: string | null;
	headline: string | null;
	experience_summary: string | null;
	bio: string | null;
	avatar_url: string | null;
	skills: string[] | null;
	certifications: string[] | null;
	extended_profile: unknown;
	can_change_email: boolean | null;
	resume_email: string | null;
};

type ExtendedProfile = {
	work_experience?: Array<{
		company: string;
		role?: string;
		title?: string;
		start_date: string;
		end_date?: string;
		location?: string;
		description?: string;
	}>;
	education?: Array<{
		institution: string;
		degree?: string;
		field?: string;
		area?: string;
		location?: string;
		start_date?: string;
		end_date?: string;
	}>;
	customSections?: Array<{
		title: string;
		entries?: Array<{
			title?: string;
			description?: string;
			value?: string;
			url?: string;
			link?: string;
		}>;
	}>;
};

function parseExtendedProfile(value: unknown): ExtendedProfile {
	if (!value) return {};
	if (typeof value === "object") return value as ExtendedProfile;
	if (typeof value !== "string") return {};
	try {
		return JSON.parse(value) as ExtendedProfile;
	} catch (error) {
		console.warn("[generate/resume] Failed to parse extended_profile:", error);
		return {};
	}
}

function buildCandidateProfile(profile: ProfileRecord, requestedEmail?: string) {
	const extended = parseExtendedProfile(profile.extended_profile);
	const requestEmail = requestedEmail?.trim() || null;
	const contactEmail = profile.can_change_email
		? requestEmail || profile.resume_email || profile.email
		: profile.email;
	const candidateProfile: CandidateProfile = {
		name: profile.full_name || "Candidate",
		email: contactEmail || undefined,
		phone: profile.phone || undefined,
		location: profile.location || undefined,
		portfolio: profile.portfolio_url || undefined,
		linkedIn: profile.linkedin_url || undefined,
		headline: profile.headline || undefined,
		summary: profile.experience_summary || profile.bio || undefined,
		profilePhotoUrl: profile.avatar_url || undefined,
		experience: (extended.work_experience ?? []).map((experience) => ({
			company: experience.company,
			title: experience.role || experience.title || "",
			startDate: experience.start_date,
			endDate: experience.end_date,
			location: experience.location || undefined,
			highlights: experience.description
				? experience.description.split(/[\n•]/).filter((item: string) => item.trim())
				: [],
		})),
		education: (extended.education ?? []).map((education) => ({
			institution: education.institution,
			degree: education.degree || "Degree",
			field: education.field || education.area || education.location || "",
			startDate: education.start_date,
			endDate: education.end_date,
		})),
		skills: profile.skills || [],
		certifications: profile.certifications || [],
		customSections: (extended.customSections ?? []).map((section) => ({
			title: section.title,
			entries: (section.entries || []).map((entry) => ({
				title: entry.title || "",
				description: entry.description || entry.value || "",
				url: entry.url || entry.link || "",
			})),
		})),
	};
	return { candidateProfile, contactEmail };
}

function profileWorkHighlights(candidateProfile: CandidateProfile) {
	return Object.fromEntries(
		candidateProfile.experience.map((experience) => [experience.company, experience.highlights])
	);
}

function ensureResumeDefaults(resumeData: ResumeData, candidateProfile: CandidateProfile) {
	resumeData.workHighlights ??= profileWorkHighlights(candidateProfile);
	resumeData.skillsOrdered = Array.isArray(resumeData.skillsOrdered)
		? resumeData.skillsOrdered
		: candidateProfile.skills;
	resumeData.extractedKeywords = Array.isArray(resumeData.extractedKeywords)
		? resumeData.extractedKeywords
		: [];
}

function ensureExperienceHighlights(resumeData: ResumeData, candidateProfile: CandidateProfile) {
	const missing: string[] = [];
	for (const experience of candidateProfile.experience) {
		const highlights = resumeData.workHighlights?.[experience.company];
		if (highlights?.length) continue;
		missing.push(experience.company);
		resumeData.workHighlights ??= {};
		resumeData.workHighlights[experience.company] = experience.highlights;
	}
	if (missing.length) {
		console.warn("[generate/resume] Missing AI highlights for companies, used profile highlights:", missing);
	}
}

function ensureCustomHighlights(resumeData: ResumeData, candidateProfile: CandidateProfile) {
	const fallbacks: string[] = [];
	resumeData.customSectionHighlights ??= {};
	for (const section of candidateProfile.customSections || []) {
		const highlights = [...(resumeData.customSectionHighlights[section.title] || [])];
		section.entries.forEach((entry, index) => {
			if (highlights[index]) return;
			fallbacks.push(`${section.title}#${index + 1}`);
			highlights[index] = entry.description || entry.title || "";
		});
		resumeData.customSectionHighlights[section.title] = highlights;
	}
	if (fallbacks.length) {
		console.warn("[generate/resume] Missing AI highlights for custom sections, used profile entries:", fallbacks);
	}
}

function parseResumeData(content: string, candidateProfile: CandidateProfile, jobTitle: string): ResumeData {
	try {
		const cleanedContent = content.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
		const resumeData = JSON.parse(cleanedContent) as ResumeData;
		ensureResumeDefaults(resumeData, candidateProfile);
		ensureExperienceHighlights(resumeData, candidateProfile);
		ensureCustomHighlights(resumeData, candidateProfile);
		return resumeData;
	} catch (error) {
		console.error("Failed to parse resume JSON:", error, content);
		return {
			extractedKeywords: [],
			summary: candidateProfile.summary || "",
			label: jobTitle,
			workHighlights: profileWorkHighlights(candidateProfile),
			skillsOrdered: candidateProfile.skills,
			customSectionHighlights: {},
		};
	}
}

async function generateCoverLetterText(
	provider: Awaited<ReturnType<typeof createProvider>>,
	model: string,
	candidateProfile: CandidateProfile,
	resumeData: ResumeData,
	jobDescription: string,
	jobTitle: string,
	companyName: string,
	recruiterName?: string
) {
	const topExperiences = candidateProfile.experience
		.flatMap((experience) => experience.highlights.slice(0, 2))
		.slice(0, 4);
	const prompt = buildCoverLetterPrompt(
		{ ...candidateProfile, topExperiences },
		jobDescription,
		jobTitle,
		companyName,
		recruiterName,
		{ extractedKeywords: resumeData.extractedKeywords || [] }
	);
	const completion = await withProviderTimeout(provider.generateCompletion({
		model,
		systemPrompt: COVER_LETTER_SYSTEM_PROMPT,
		userPrompt: prompt,
		temperature: 0.5,
		maxTokens: 1200,
		responseFormat: "text",
	}));
	return completion.content.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}

async function generationErrorResponse(
	error: unknown,
	creditReservationId: string | null,
	hasUsableGeneration: boolean,
	aiConfig: ProviderInitConfig
) {
	console.error("AI generation error:", error);
	if (!(error instanceof ProviderError)) {
		return NextResponse.json({ error: "Failed to generate content. Please try again." }, { status: 500 });
	}
	if (creditReservationId && !hasUsableGeneration) {
		try {
			const { error: refundError } = await createServiceSupabase().rpc("refund_generation_credit", {
				p_reservation_id: creditReservationId,
			});
			if (refundError) console.error("Credit refund error:", refundError);
		} catch (refundError) {
			console.error("Credit refund error:", refundError);
		}
	}
	const usesPlatformKey =
		aiConfig.apiKey === process.env.GROQ_API_KEY || aiConfig.apiKey === process.env.OPENAI_API_KEY;
	const message = usesPlatformKey
		? "The built-in AI service is unavailable right now. Add your own API key in Settings → AI Provider, or try again later."
		: [error.message, error.suggestion].filter(Boolean).join(" ");
	return NextResponse.json({ error: message, type: error.type }, { status: 502 });
}

async function withProviderTimeout<T>(promise: Promise<T>, timeoutMs = 60_000) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new ProviderError(ProviderErrorType.CONNECTION_FAILED, "AI provider timed out.")),
					timeoutMs
				);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

function buildGenerationLogEntries(
	userId: string,
	provider: string,
	model: string,
	includesCoverLetter: boolean
): AiGenerationEntry[] {
	const entries: AiGenerationEntry[] = [
		{ userId, feature: "resume", model, provider, itemType: "resume" },
	];
	if (includesCoverLetter) {
		entries.push({ userId, feature: "cover_letter", model, provider, itemType: "cover_letter" });
	}
	return entries;
}

/**
 * Get AI configuration from user settings, falling back to environment variables
 */
async function getAIConfig(
	supabase: ReturnType<typeof createServerSupabase>,
	userId: string
): Promise<ProviderInitConfig | null> {
	// First try to get user's saved settings
	const { data: settings } = await supabase
		.from("user_settings")
		.select("ai_provider, ai_api_key_encrypted, ai_base_url, ai_default_model")
		.eq("user_id", userId)
		.single();

	const provider = settings?.ai_provider || "groq";
	const apiKey = settings?.ai_api_key_encrypted
		? decryptApiKey(settings.ai_api_key_encrypted)
		: null;
	const baseURL = settings?.ai_base_url || undefined;
	const model = settings?.ai_default_model || undefined;
	const defaultModels: Record<string, string> = {
		groq: "llama-3.3-70b-versatile",
		openai: "gpt-4o-mini",
		anthropic: "claude-3-5-sonnet-20241022",
		gemini: "gemini-1.5-flash",
	};

	if (apiKey) {
		return { provider, apiKey, baseURL, model: model || defaultModels[provider] };
	}

	const environmentConfigs: Record<string, ProviderInitConfig | null> = {
		groq: process.env.GROQ_API_KEY ? {
			provider: "groq", apiKey: process.env.GROQ_API_KEY,
			baseURL: "https://api.groq.com/openai/v1", model: model || defaultModels.groq,
		} : null,
		openai: process.env.OPENAI_API_KEY ? {
			provider: "openai", apiKey: process.env.OPENAI_API_KEY,
			baseURL: process.env.OPENAI_BASE_URL || undefined, model: model || defaultModels.openai,
		} : null,
	};
	return environmentConfigs[provider] || environmentConfigs.openai || environmentConfigs.groq || null;
}

export async function POST(req: NextRequest) {
	const supabase = createServerSupabase();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
	}

	// Parse request body
	const parsed = await parseJson(req, generateSchema);
	if (!parsed.success) return parsed.response;
	const body = parsed.data;

	const {
		jobTitle,
		jobDescription,
		companyName,
		recruiterName,
		contactEmail,
		generateCoverLetter = true,
	} = body;

	// Fetch user profile
	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.select("full_name,email,phone,location,portfolio_url,linkedin_url,headline,experience_summary,bio,avatar_url,skills,certifications,extended_profile,can_change_email,resume_email")
		.eq("id", user.id)
		.single();

	if (profileError || !profile) {
		return NextResponse.json(
			{ error: "Profile not found. Please complete your profile first." },
			{ status: 404 }
		);
	}

	const { candidateProfile, contactEmail: contactEmailEffective } = buildCandidateProfile(
		profile as ProfileRecord,
		contactEmail
	);

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

	// Create provider instance using factory
	const provider = await createProvider(aiConfig);
	const model = aiConfig.model || "gpt-4o-mini";
	let creditReservationId: string | null = null;
	let hasUsableGeneration = false;

	// Eligibility and credit consumption happen in one locked database transaction.
	const { data: reservation, error: reservationError } = await supabase.rpc(
		"reserve_generation_credit"
	);

	if (reservationError || !reservation) {
		console.error("Credit reservation error:", reservationError);
		return NextResponse.json(
			{ error: "Unable to reserve a generation credit. Please try again." },
			{ status: 503 }
		);
	}

	if (!reservation.reserved) {
		return NextResponse.json(
			{
				error: "Generation credit limit reached. Add your own API key in Settings to continue.",
				quotaExceeded: true,
				quota: { remaining: reservation.remaining ?? 0 },
			},
			{ status: 403 }
		);
	}

	creditReservationId = reservation.charged
		? reservation.reservation_id
		: null;
	const photoPromise = fetchPhotoAsBase64(profile.avatar_url);

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

		// LOG 1: Input structure going to AI
		console.log("=".repeat(80));
		console.log("📤 INPUT TO AI - Resume Generation");
		console.log("=".repeat(80));
		console.log("Provider:", aiConfig.provider);
		console.log("Model:", model);
		console.log("Temperature:", 0.3);
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
			customSections: candidateProfile.customSections.map((section) => ({
				title: section.title,
				entries: section.entries.map((entry) => ({
					title: entry.title,
					hasUrl: !!entry.url,
					descriptionPreview: entry.description?.slice(0, 60) || ""
				}))
			}))
		}, null, 2));
		console.log("=".repeat(80));

		// Use provider abstraction for completion
		const resumeCompletion = await withProviderTimeout(provider.generateCompletion({
			model,
			systemPrompt: RESUME_SYSTEM_PROMPT,
			userPrompt: resumePrompt,
			temperature: 0.3,
			maxTokens: 4500,
			responseFormat: "json",
		}));
		const resumeContent = resumeCompletion.content;
		hasUsableGeneration = resumeContent.trim().length > 0;

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

		const resumeData = parseResumeData(resumeContent, candidateProfile, jobTitle);

		// ============================================
		// PHASE 2: Generate cover letter with extracted keywords
		// ============================================
		const coverLetter = generateCoverLetter
			? await generateCoverLetterText(
					provider, model, candidateProfile, resumeData, jobDescription,
					jobTitle, companyName, recruiterName
				)
			: "";

		// Fetch profile photo as base64 for embedding in resume HTML
		const imageBase64 = await photoPromise;
		const aiGenerationIds = await logAiGenerations(
			supabase,
			buildGenerationLogEntries(user.id, aiConfig.provider, model, coverLetter.length > 0)
		);

		return NextResponse.json({
			success: true,
			aiGenerated: true,
			aiGenerationIds,
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
				email: contactEmailEffective || profile.email,
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
		return generationErrorResponse(error, creditReservationId, hasUsableGeneration, aiConfig);
	}
}
