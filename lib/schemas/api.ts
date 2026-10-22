import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z.union([z.string().trim().url().max(2048), z.literal(""), z.null()]).optional();

export const companyCreateSchema = z.object({
	name: z.string().trim().min(1).max(200),
	website: optionalUrl,
	industry: optionalText(120),
	status: z.string().trim().min(1).max(40).optional(),
	jobTitle: optionalText(200),
	jobDescription: optionalText(30_000),
	jobUrl: optionalUrl,
	recruiterName: optionalText(200),
	recruiterEmail: z.union([z.string().trim().email().max(254), z.literal(""), z.null()]).optional(),
	salaryRange: optionalText(120),
	notes: optionalText(10_000),
	appliedAt: z.string().datetime().nullable().optional(),
	followUpDate: z.string().datetime().nullable().optional(),
	resume: z.record(z.unknown()).optional(),
	coverLetter: z.string().max(30_000).optional(),
	templateId: z.string().trim().min(1).max(100),
	coverLetterTemplateId: z.string().trim().max(100).optional(),
	existingCompanyId: z.string().uuid().optional(),
}).strict();

export const companyUpdateSchema = z.object({
	name: optionalText(200),
	website: optionalUrl,
	industry: optionalText(120),
	status: optionalText(40),
	jobTitle: optionalText(200),
	jobDescription: optionalText(30_000),
	jobUrl: optionalUrl,
	recruiterName: optionalText(200),
	recruiterEmail: z.union([z.string().trim().email().max(254), z.literal(""), z.null()]).optional(),
	salaryRange: optionalText(120),
	notes: optionalText(10_000),
	appliedAt: z.string().datetime().nullable().optional(),
	followUpDate: z.string().datetime().nullable().optional(),
	interviewAt: z.string().datetime().nullable().optional(),
	interviewRounds: z.array(z.object({
		date: z.string().datetime(),
		notes: z.string().max(2000).default(""),
	}).strict()).max(50).optional(),
}).strict();

export const importPdfPreviewSchema = z.object({
	filenames: z.array(z.string().trim().min(1).max(255).regex(/\.pdf$/i)).min(1).max(200),
}).strict();

export const importProfileSchema = z.object({
	fields: z.record(z.unknown()),
}).strict();

export const trackerImportSchema = z.object({
	csv: z.string().trim().min(1).max(2 * 1024 * 1024),
	mode: z.enum(["preview", "apply"]).default("preview"),
	skip: z.array(z.number().int().min(0)).max(10_000).optional(),
}).strict();

export const modelLookupSchema = z.object({
	provider: z.enum(["openai", "groq", "anthropic", "gemini", "custom"]).default("openai"),
	apiKey: z.string().trim().min(1).max(4096),
	baseUrl: z.string().trim().url().max(2048).optional(),
}).strict();

export const settingsSchema = z.object({
	provider: z.enum(["openai", "groq", "anthropic", "gemini", "custom"]),
	apiKey: z.string().max(4096).optional(),
	baseUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).optional(),
	defaultModel: z.string().trim().max(200).optional(),
}).strict();

export const settingsVerificationSchema = z.object({ verified: z.boolean() }).strict();

const boundedStringList = z.array(z.string().trim().min(1).max(200)).max(100);

export const mcpTokenCreateSchema = z.object({
	name: z.string().trim().min(1).max(80),
	scopes: z.array(z.enum(["read", "write"])).min(1).max(2).default(["read", "write"]),
}).strict();

export const watchedCompanyCreateSchema = z.object({
	company: z.string().trim().min(1).max(200),
	ats: z.string().trim().max(40).optional(),
	board_token: z.string().trim().max(120).optional(),
	careers_url: z.string().trim().url().max(2048).optional(),
	enabled: z.boolean().optional(),
}).strict();

export const watchedCompanyUpdateSchema = watchedCompanyCreateSchema.partial().strict();

export const jobSearchCreateSchema = z.object({
	name: z.string().trim().max(100).optional(),
	keywords: boundedStringList.min(1),
	include_keywords: boundedStringList.optional(),
	exclude_keywords: boundedStringList.optional(),
	locations: boundedStringList.optional(),
	sites: boundedStringList.optional(),
	sources: boundedStringList.optional(),
	country: z.string().trim().min(2).max(3).optional(),
	remote_ok: z.boolean().optional(),
	hours_old: z.number().int().min(1).max(720).optional(),
	results_wanted: z.number().int().min(1).max(500).optional(),
	enabled: z.boolean().optional(),
}).strict();

export const jobSearchUpdateSchema = jobSearchCreateSchema.partial().strict();

export const jobMatchUpdateSchema = z.union([
	z.object({ company_id: z.string().uuid() }).strict(),
	z.object({ status: z.enum(["new", "shortlisted", "skipped"]) }).strict(),
]);

export const documentUpdateSchema = z.object({
	content_json: z.record(z.unknown()),
	template: z.string().trim().max(100).optional(),
	accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).or(z.literal("")).optional(),
	paper: z.enum(["a4", "letter"]).optional(),
	content: z.string().max(100_000).optional(),
	engine: z.enum(["typst", "html"]).optional(),
}).strict();

export const rankingSettingsUpdateSchema = z.object({
	minSalary: z.number().finite().min(0).max(1e12).optional(),
	minSalaryCurrency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
	homeCountry: z.string().trim().min(1).max(60).optional(),
	knownLanguages: z.array(z.string().trim().min(1).max(80)).min(1).max(20).optional(),
	needsVisaSponsorshipAbroad: z.boolean().optional(),
	excludedLocations: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
	excludedCompanies: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
	dailyLlmLimit: z.number().int().min(0).max(200).optional(),
	digestEnabled: z.boolean().optional(),
	digestHour: z.number().int().min(0).max(23).optional(),
	timezone: z.string().trim().min(1).max(100).optional(),
}).strict();

const workExperienceSchema = z.object({
	id: z.string().max(100).optional(),
	company: z.string().max(200).optional(),
	role: z.string().max(200).optional(),
	location: z.string().max(200).optional(),
	start_date: z.string().max(40).optional(),
	end_date: z.string().max(40).nullable().optional(),
	description: z.string().max(10_000).optional(),
}).strict();
const educationSchema = z.object({
	id: z.string().max(100).optional(),
	institution: z.string().max(300).optional(),
	degree: z.string().max(300).optional(),
	location: z.string().max(200).optional(),
	start_date: z.string().max(40).optional(),
	end_date: z.string().max(40).optional(),
}).strict();
const customEntrySchema = z.object({
	id: z.string().max(100).optional(),
	title: z.string().max(300).optional(),
	value: z.string().max(10_000).optional(),
}).strict();

export const profileUpdateSchema = z.object({
	profile: z.object({
		full_name: z.string().trim().max(200).optional(),
		email: z.string().trim().email().max(254).optional(),
		resume_email: z.union([z.string().trim().email().max(254), z.literal(""), z.null()]).optional(),
		phone: z.string().max(50).optional(),
		location: z.string().max(300).optional(),
		bio: z.string().max(10_000).optional(),
		website: z.string().max(2048).optional(),
		linkedin_url: z.string().max(2048).optional(),
		github_url: z.string().max(2048).optional(),
		avatar_url: z.string().max(7_500_000).nullable().optional(),
		skills: z.array(z.string().trim().min(1).max(100)).max(200).optional(),
		work_experience: z.array(workExperienceSchema).max(100).optional(),
		education: z.array(educationSchema).max(100).optional(),
		custom_fields: z.array(z.object({
			id: z.string().max(100).optional(),
			label: z.string().max(200).optional(),
			value: z.string().max(5000).optional(),
		}).strict()).max(100).optional(),
	}).strict().default({}),
	customSections: z.array(z.object({
		id: z.string().max(100).optional(),
		title: z.string().max(200).optional(),
		entries: z.array(customEntrySchema).max(100).optional(),
	}).strict()).max(50).optional(),
}).strict();
