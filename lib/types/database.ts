/**
 * OrbitHire Database Schema Types
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
	photo_url: string | null;
	photo_key: string | null; // R2 storage key

	// Parsed resume data
	skills: string[];
	experience_summary: string | null;
	education_summary: string | null;

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

	created_at: string;
	updated_at: string;
}

export interface CoverLetter {
	id: string;
	user_id: string;
	company_id: string | null;
	resume_id: string | null; // Link to associated resume
	title: string;

	content: string;
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

	created_at: string;
	updated_at: string;
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
		photo_url?: string; // Only for EU/DE templates
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
