/**
 * NextMilestone database schema types
 * These types mirror the Supabase database tables
 */

// ==================== USER & PROFILE ====================

export interface Profile {
	id: string; // UUID, references auth.users(id)
	email: string;
	full_name: string | null;
	headline: string | null;
	phone: string | null;
	location: string | null;
	linkedin_url: string | null;
	portfolio_url: string | null;
	avatar_url: string | null;
	avatar_key: string | null; // R2 storage key

	// Parsed resume data
	skills: string[];
	experience_summary: string | null;
	extended_profile: string | null; // JSON: work_experience[], education[], custom_fields[], customSections[]

	// Preferences
	target_job_titles: string[];
	preferred_locations: string[];
	work_type: "remote" | "hybrid" | "onsite" | null;
	salary_range: string | null;
	start_availability: "immediately" | "2weeks" | "1month" | "flexible" | null;

	// Onboarding state
	onboarding_completed: boolean;
	onboarding_step: number;

	// Notification preferences
	email_notifications: boolean;
	push_notifications: boolean;
	quiet_hours_start: string | null; // HH:MM format
	quiet_hours_end: string | null;

	created_at: string;
	updated_at: string;
}

// ==================== COMPANY FOLDERS ====================

export interface Company {
	id: string; // UUID
	user_id: string;
	name: string;
	website: string | null;
	industry: string | null;
	notes: string | null;
	status:
		| "saved"
		| "applied"
		| "interviewing"
		| "offered"
		| "rejected"
		| "withdrawn";
	applied_at: string | null;
	created_at: string;
	updated_at: string;
}

// ==================== RESUMES & COVER LETTERS ====================

export interface Resume {
	id: string;
	user_id: string;
	company_id: string | null; // Optional link to company
	title: string;

	// Content
	content_json: ResumeContent;
	content_text: string; // Plain text version for search

	// Generation context
	job_description: string | null;
	country: string; // ISO country code
	template: string; // Template identifier
	model_used: "quality" | "fast";

	// Analysis from generation
	keyword_analysis: KeywordAnalysis | null;
	bullet_variants: BulletVariant[] | null;

	// Storage
	pdf_url: string | null;
	pdf_key: string | null;
	docx_url: string | null;
	docx_key: string | null;

	// Sharing
	share_token: string | null;
	share_expires_at: string | null;
	share_access_count: number;
	is_public: boolean;

	// v2: rendering + provenance (migration 20250101000018)
	engine: DocumentEngine;
	pdf_status: PdfStatus;
	pdf_error: string | null;
	source: DocumentSource;
	source_client: string | null; // e.g. "claude", "chatgpt"
	job_posting_id: string | null;

	created_at: string;
	updated_at: string;
}

export interface CoverLetter {
	id: string;
	user_id: string;
	company_id: string | null;
	resume_id: string | null; // Link to associated resume
	title: string;

	content: string | null; // Legacy plain text; null allowed when content_json is set
	content_json: CoverLetterContent | null;
	job_description: string | null;
	country: string;
	template: string;
	model_used: "quality" | "fast";

	pdf_url: string | null;
	pdf_key: string | null;
	docx_url: string | null;
	docx_key: string | null;

	share_token: string | null;
	share_expires_at: string | null;
	share_access_count: number;
	is_public: boolean;

	// v2: rendering + provenance (migration 20250101000018)
	engine: DocumentEngine;
	pdf_status: PdfStatus;
	pdf_error: string | null;
	source: DocumentSource;
	source_client: string | null;
	job_posting_id: string | null;

	created_at: string;
	updated_at: string;
}

export type DocumentEngine = "html" | "typst";
export type PdfStatus = "none" | "queued" | "rendering" | "ready" | "failed";
export type DocumentSource = "portal" | "mcp" | "import";
export type DocumentType = "resume" | "cover_letter";

export interface CoverLetterContent {
	recipient?: {
		name?: string;
		title?: string;
		company?: string;
		address?: string;
	};
	salutation: string;
	paragraphs: string[];
	closing: string;
}

export interface DocumentVersion {
	id: string;
	user_id: string;
	document_type: DocumentType;
	document_id: string; // resumes.id or cover_letters.id
	version: number; // Auto-assigned (max + 1) when omitted on insert
	content_json: Record<string, unknown>;
	source: DocumentSource;
	created_at: string;
}

// ==================== RESUME CONTENT STRUCTURE ====================

export interface ResumeContent {
	personal: {
		name: string;
		headline: string;
		email: string;
		phone: string;
		location: string;
		linkedin?: string;
		portfolio?: string;
		avatar_url?: string; // Only for EU/DE templates
	};
	summary: string;
	experience: ExperienceEntry[];
	education: EducationEntry[];
	skills: SkillCategory[];
	certifications?: CertificationEntry[];
	languages?: LanguageEntry[];
	custom_sections?: CustomSection[];
}

export interface ExperienceEntry {
	id: string;
	company: string;
	title: string;
	location: string;
	start_date: string;
	end_date: string | null;
	is_current: boolean;
	bullets: string[];
}

export interface EducationEntry {
	id: string;
	institution: string;
	degree: string;
	field: string;
	location: string;
	start_date: string;
	end_date: string | null;
	gpa?: string;
	honors?: string[];
}

export interface SkillCategory {
	category: string;
	skills: string[];
}

export interface CertificationEntry {
	name: string;
	issuer: string;
	date: string;
	url?: string;
}

export interface LanguageEntry {
	language: string;
	proficiency: "native" | "fluent" | "professional" | "intermediate" | "basic";
}

export interface CustomSection {
	title: string;
	entries: { title: string; description: string }[];
}

// ==================== GENERATION ANALYSIS ====================

export interface KeywordAnalysis {
	matched_keywords: string[];
	missing_keywords: string[];
	match_percentage: number;
	suggestions: string[];
}

export interface BulletVariant {
	original: string;
	variants: string[];
	experience_id: string;
}

// ==================== FOLLOW-UPS ====================

export interface FollowUp {
	id: string;
	user_id: string;
	company_id: string;
	resume_id: string | null;

	// Send tracking
	sent_at: string;
	sent_method: "email" | "linkedin" | "portal" | "other";
	recipient_email: string | null;
	recipient_name: string | null;

	// Reminder scheduling
	next_reminder_at: string | null;
	reminder_cadence_days: number; // Default 3
	reminder_count: number;
	max_reminders: number;

	// State
	status: "active" | "snoozed" | "stopped" | "completed";
	snoozed_until: string | null;
	response_received: boolean;
	response_notes: string | null;

	// Notification state
	last_notification_at: string | null;
	last_notification_status: "sent" | "failed" | "pending" | null;
	notification_retry_count: number;
	opted_out: boolean;

	created_at: string;
	updated_at: string;
}

export interface FollowUpNotification {
	id: string;
	follow_up_id: string;
	user_id: string;

	scheduled_at: string;
	sent_at: string | null;

	channel: "email" | "push";
	status: "pending" | "sent" | "failed" | "skipped";
	error_message: string | null;
	retry_count: number;

	created_at: string;
}

// ==================== FILE UPLOADS ====================

export interface FileUpload {
	id: string;
	user_id: string;

	file_name: string;
	file_type: "resume" | "cover_letter" | "profile_photo" | "other";
	mime_type: string;
	file_size: number;

	storage_key: string; // R2 key
	storage_url: string | null; // Signed URL (temporary)

	// Parsing results for resume uploads
	parsed_successfully: boolean | null;
	parse_error: string | null;
	extracted_data: Record<string, unknown> | null;

	created_at: string;
}

// ==================== SHARE LINKS ====================

export interface ShareLink {
	id: string;
	user_id: string;

	resource_type: "resume" | "cover_letter";
	resource_id: string;

	token: string;
	is_public: boolean; // If false, requires token
	expires_at: string | null;

	access_count: number;
	last_accessed_at: string | null;

	created_at: string;
}

export interface ShareAccess {
	id: string;
	share_link_id: string;

	accessed_at: string;
	ip_address: string | null;
	user_agent: string | null;
	referrer: string | null;
}

// ==================== ANALYTICS & METRICS ====================

export interface UserActivity {
	id: string;
	user_id: string;

	event_type:
		| "signup"
		| "profile_complete"
		| "resume_upload"
		| "resume_parse_success"
		| "resume_parse_fail"
		| "generate_start"
		| "generate_success"
		| "generate_fail"
		| "save_resume"
		| "save_cover_letter"
		| "export_pdf"
		| "export_docx"
		| "share_create"
		| "follow_up_log"
		| "follow_up_snooze"
		| "follow_up_stop"
		| "notification_opt_in"
		| "notification_opt_out";

	metadata: Record<string, unknown>;

	created_at: string;
}

// ==================== GENERATION SETTINGS ====================

export interface CountryTemplate {
	country_code: string;
	country_name: string;

	// Photo rules
	photo_allowed: boolean;
	photo_required: boolean;

	// Section ordering
	section_order: string[];

	// Template styles
	available_templates: string[];
	default_template: string;

	// Special formatting
	date_format: string;
	address_format: string;

	// Prompts
	prompt_additions: string;
}

// ==================== TASK QUEUE ====================

export type TaskType =
	| "fetch_jobs"
	| "rank_jobs"
	| "render_pdf"
	| "thumbnail"
	| "digest"
	| "noop";

export type TaskStatus = "queued" | "running" | "done" | "failed";

export interface Task {
	id: string;
	type: TaskType;
	payload: Record<string, unknown>;
	status: TaskStatus;
	priority: number; // Higher runs first
	attempts: number;
	max_attempts: number;
	run_after: string;
	locked_at: string | null;
	locked_by: string | null; // Worker id
	last_error: string | null;
	result: Record<string, unknown> | null;
	user_id: string | null; // Null for system tasks
	created_at: string;
	updated_at: string;
}

/** Arguments for supabase.rpc("enqueue_task", ...) – returns the new task id */
export interface EnqueueTaskArgs {
	p_type: TaskType;
	p_payload?: Record<string, unknown>;
	p_priority?: number; // Clamped to [-10, 10] for logged-in users
	p_user_id?: string | null; // Forced to auth.uid() for logged-in users
}

// ==================== JOB SEARCH ====================

export type JobSite =
	| "linkedin"
	| "indeed"
	| "naukri"
	| "glassdoor"
	| "google"
	| "zip_recruiter"
	| "bayt"
	| "bdjobs";

export interface JobSearch {
	id: string;
	user_id: string;
	name: string;
	keywords: string[];
	exclude_keywords: string[];
	locations: string[];
	sites: JobSite[];
	remote_ok: boolean;
	hours_old: number; // Default 24
	results_wanted: number;
	enabled: boolean;
	created_at: string;
	updated_at: string;
}

export type AtsProvider = "greenhouse" | "lever" | "ashby";

export interface WatchedCompany {
	id: string;
	user_id: string;
	company: string;
	ats: AtsProvider;
	board_token: string;
	careers_url: string | null;
	enabled: boolean;
	created_at: string;
	updated_at: string;
}

/** Global, deduplicated posting (written by the worker only) */
export interface JobPosting {
	id: string;
	dedupe_key: string; // Normalized company + title + location
	source: string; // JobSite | AtsProvider
	external_id: string | null;
	url: string | null;
	title: string;
	company: string;
	location: string | null;
	is_remote: boolean | null;
	salary_min: number | null;
	salary_max: number | null;
	currency: string | null;
	salary_interval: string | null; // yearly | monthly | hourly ...
	description: string | null;
	posted_at: string | null;
	first_seen_at: string;
	last_seen_at: string;
	is_active: boolean;
	raw: Record<string, unknown> | null;
	embedding: string | null; // pgvector(1536), serialized by PostgREST as "[0.1,...]"
	created_at: string;
	updated_at: string;
}

export type JobMatchStatus =
	| "new"
	| "shortlisted"
	| "skipped"
	| "applied"
	| "expired";

/** A posting as seen by one user */
export interface JobMatch {
	id: string;
	user_id: string;
	job_posting_id: string;
	search_id: string | null; // Null when found via the watchlist
	prefilter_pass: boolean | null;
	similarity: number | null;
	llm_score: number | null; // 0-100
	llm_reasons: Record<string, unknown> | null;
	deal_breakers: Record<string, unknown> | unknown[] | null;
	status: JobMatchStatus;
	company_id: string | null; // Set when it becomes an application
	seen_at: string | null;
	created_at: string;
	updated_at: string;
}

// ==================== MCP TOKENS ====================

export interface McpToken {
	id: string;
	user_id: string;
	name: string;
	token_hash: string; // Never the raw token
	token_prefix: string | null; // Shown in the UI, e.g. "orb_ab12"
	scopes: string[];
	last_used_at: string | null;
	revoked_at: string | null;
	created_at: string;
}

// ==================== API TYPES ====================

export interface GenerationRequest {
	job_description: string;
	country: string;
	template: string;
	model: "quality" | "fast";
	include_photo: boolean;
	company_id?: string;
}

export interface GenerationResponse {
	resume: ResumeContent;
	cover_letter: string;
	analysis: KeywordAnalysis;
	variants: BulletVariant[];
}

export interface UploadSignedUrlRequest {
	file_name: string;
	file_type: "resume" | "cover_letter" | "profile_photo" | "other";
	mime_type: string;
	file_size: number;
}

export interface UploadSignedUrlResponse {
	upload_id: string;
	signed_url: string;
	expires_at: string;
}
