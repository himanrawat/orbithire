/**
 * Interview prep (PRD area 4): shared vocabularies and types. Client-safe, no I/O.
 * Values match the CHECK constraints in supabase/migrations/20261024000800_interview_prep.sql.
 */

export const PREP_ROLES = ["frontend_engineer", "software_engineer"] as const;
export type PrepRole = (typeof PREP_ROLES)[number];

export const PREP_TOPICS = [
	"behavioral",
	"javascript",
	"react",
	"web_fundamentals",
	"system_design",
	"leadership",
] as const;
export type PrepTopic = (typeof PREP_TOPICS)[number];

export const PREP_LEVELS = ["entry", "mid", "senior", "lead"] as const;
export type PrepLevel = (typeof PREP_LEVELS)[number];

export const PREP_STAGES = [
	"recruiter_screen",
	"technical_screen",
	"onsite",
	"system_design",
	"hiring_manager",
] as const;
export type PrepStage = (typeof PREP_STAGES)[number];

export const COMPANY_TYPES = ["early_stage", "growth", "big_tech", "enterprise"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const INTERVIEW_ROUNDS = [...PREP_STAGES, "other"] as const;
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number];

export const INPUT_MODES = ["text", "voice"] as const;
export type InputMode = (typeof INPUT_MODES)[number];

export const SOURCE_KINDS = ["curated", "user_reports"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const ROLE_LABELS: Readonly<Record<PrepRole, string>> = {
	frontend_engineer: "Frontend engineer",
	software_engineer: "Software engineer",
};

export const TOPIC_LABELS: Readonly<Record<PrepTopic, string>> = {
	behavioral: "Behavioral",
	javascript: "JavaScript",
	react: "React",
	web_fundamentals: "Web fundamentals",
	system_design: "Frontend system design",
	leadership: "Leadership",
};

export const LEVEL_LABELS: Readonly<Record<PrepLevel, string>> = {
	entry: "Entry",
	mid: "Mid",
	senior: "Senior",
	lead: "Lead",
};

export const STAGE_LABELS: Readonly<Record<PrepStage, string>> = {
	recruiter_screen: "Recruiter screen",
	technical_screen: "Technical screen",
	onsite: "Onsite",
	system_design: "System design",
	hiring_manager: "Hiring manager",
};

export const ROUND_LABELS: Readonly<Record<InterviewRound, string>> = {
	...STAGE_LABELS,
	other: "Other",
};

export const COMPANY_TYPE_LABELS: Readonly<Record<CompanyType, string>> = {
	early_stage: "Early-stage startup",
	growth: "Growth-stage",
	big_tech: "Big tech",
	enterprise: "Enterprise",
};

export const SOURCE_LABELS: Readonly<Record<SourceKind, string>> = {
	curated: "Curated set",
	user_reports: "User reports",
};

export type PrepQuestion = {
	id: string;
	slug: string;
	role: PrepRole;
	topic: PrepTopic;
	level: PrepLevel;
	stages: PrepStage[];
	companyTypes: CompanyType[];
	prompt: string;
	frameworkHint: string | null;
	mostAsked: boolean;
	sourceKind: SourceKind;
	sourceNote: string;
};

export type PrepFeedback = {
	strength: string;
	gap: string;
	nextRead: { title: string; detail: string };
};

export type PracticeAttempt = {
	id: string;
	questionId: string;
	answerText: string;
	inputMode: InputMode;
	feedback: PrepFeedback | null;
	feedbackModel: string | null;
	flaggedWrong: boolean;
	mockId: string | null;
	createdAt: string;
};

export type ChecklistItem = { id: string; label: string; done: boolean };

export type InterviewCard = {
	id: string;
	companyId: string;
	companyName: string;
	scheduledAt: string;
	round: InterviewRound;
	companyType: CompanyType | null;
	checklist: ChecklistItem[];
	notes: string | null;
};

/** Free plan cap the pricing area can enforce (PRD area 10); not enforced here. */
export const FREE_FEEDBACK_PER_MONTH = 10;
