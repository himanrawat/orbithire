/**
 * Server-only data access for interview prep. Every query uses the caller's RLS-scoped
 * client (createServerSupabase via requireUser), so users only ever see their own rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabaseServer";
import type {
	CompanyType,
	InterviewCard,
	InterviewRound,
	PracticeAttempt,
	PrepQuestion,
	InputMode,
} from "./constants";
import { defaultChecklist } from "./interviews";
import {
	parseStoredChecklist,
	parseStoredFeedback,
	type InterviewPatch,
	type QuestionFilters,
} from "./schema";

type Row = Record<string, unknown>;

const QUESTION_COLUMNS =
	"id, slug, role, topic, level, stages, company_types, prompt, framework_hint, most_asked, source_kind, source_note";
const ATTEMPT_COLUMNS =
	"id, question_id, answer_text, input_mode, feedback, feedback_model, flagged_wrong, mock_id, created_at";
const INTERVIEW_COLUMNS =
	"id, company_id, scheduled_at, round, company_type, checklist, notes, companies(name)";

export const QUESTION_LIST_LIMIT = 200;

function str(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function strArray<T extends string>(value: unknown): T[] {
	return Array.isArray(value) ? (value.filter((v) => typeof v === "string") as T[]) : [];
}

function relatedName(value: unknown): string {
	const rel = Array.isArray(value) ? value[0] : value;
	if (rel && typeof rel === "object") return str((rel as Row).name) ?? "a company";
	return "a company";
}

export function toQuestion(row: Row): PrepQuestion {
	return {
		id: String(row.id),
		slug: String(row.slug),
		role: row.role as PrepQuestion["role"],
		topic: row.topic as PrepQuestion["topic"],
		level: row.level as PrepQuestion["level"],
		stages: strArray(row.stages),
		companyTypes: strArray(row.company_types),
		prompt: String(row.prompt),
		frameworkHint: str(row.framework_hint),
		mostAsked: row.most_asked === true,
		sourceKind: row.source_kind === "user_reports" ? "user_reports" : "curated",
		sourceNote: str(row.source_note) ?? "Curated set",
	};
}

export function toAttempt(row: Row): PracticeAttempt {
	return {
		id: String(row.id),
		questionId: String(row.question_id),
		answerText: String(row.answer_text ?? ""),
		inputMode: row.input_mode === "voice" ? "voice" : "text",
		feedback: parseStoredFeedback(row.feedback),
		feedbackModel: str(row.feedback_model),
		flaggedWrong: row.flagged_wrong === true,
		mockId: str(row.mock_id),
		createdAt: String(row.created_at),
	};
}

export function toInterview(row: Row): InterviewCard {
	return {
		id: String(row.id),
		companyId: String(row.company_id),
		companyName: relatedName(row.companies),
		scheduledAt: String(row.scheduled_at),
		round: row.round as InterviewRound,
		companyType: (str(row.company_type) as CompanyType | null) ?? null,
		checklist: parseStoredChecklist(row.checklist),
		notes: str(row.notes),
	};
}

// ==================== QUESTIONS ====================

export async function listQuestions(
	supabase: SupabaseClient,
	filters: QuestionFilters
): Promise<PrepQuestion[]> {
	let query = supabase.from("questions").select(QUESTION_COLUMNS);
	if (filters.role) query = query.eq("role", filters.role);
	if (filters.topic) query = query.eq("topic", filters.topic);
	if (filters.level) query = query.eq("level", filters.level);
	if (filters.stage) query = query.contains("stages", [filters.stage]);
	if (filters.companyType) query = query.contains("company_types", [filters.companyType]);
	if (filters.mostAsked) query = query.eq("most_asked", true);
	const { data, error } = await query
		.order("most_asked", { ascending: false })
		.order("topic", { ascending: true })
		.order("slug", { ascending: true })
		.limit(QUESTION_LIST_LIMIT);
	if (error) throw new Error(error.message);
	return ((data ?? []) as Row[]).map(toQuestion);
}

export async function getQuestion(supabase: SupabaseClient, id: string): Promise<PrepQuestion | null> {
	const { data } = await supabase.from("questions").select(QUESTION_COLUMNS).eq("id", id).maybeSingle();
	return data ? toQuestion(data as Row) : null;
}

export async function insertQuestionReport(
	supabase: SupabaseClient,
	userId: string,
	report: Readonly<{ prompt: string; role?: string; companyType?: CompanyType; questionId?: string }>
): Promise<string> {
	const { data, error } = await supabase
		.from("question_reports")
		.insert({
			user_id: userId,
			prompt: report.prompt,
			role: report.role || null,
			company_type: report.companyType ?? null,
			question_id: report.questionId ?? null,
		})
		.select("id")
		.single();
	if (error || !data) throw new Error(error?.message ?? "Could not save the report");
	return String((data as Row).id);
}

// ==================== PRACTICE ATTEMPTS ====================

export type AttemptInsert = Readonly<{
	questionId: string;
	answerText: string;
	transcript: string | null;
	inputMode: InputMode;
	mockId: string | null;
	feedback: PracticeAttempt["feedback"];
	feedbackModel: string | null;
}>;

export async function insertAttempt(
	supabase: SupabaseClient,
	userId: string,
	attempt: AttemptInsert
): Promise<PracticeAttempt> {
	const { data, error } = await supabase
		.from("practice_attempts")
		.insert({
			user_id: userId,
			question_id: attempt.questionId,
			answer_text: attempt.answerText,
			transcript: attempt.transcript,
			input_mode: attempt.inputMode,
			mock_id: attempt.mockId,
			feedback: attempt.feedback,
			feedback_model: attempt.feedbackModel,
		})
		.select(ATTEMPT_COLUMNS)
		.single();
	if (error || !data) throw new Error(error?.message ?? "Could not save the attempt");
	return toAttempt(data as Row);
}

export async function flagAttemptWrong(
	supabase: SupabaseClient,
	userId: string,
	id: string
): Promise<PracticeAttempt | null> {
	const { data, error } = await supabase
		.from("practice_attempts")
		.update({ flagged_wrong: true })
		.eq("id", id)
		.eq("user_id", userId)
		.select(ATTEMPT_COLUMNS)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return data ? toAttempt(data as Row) : null;
}

export async function listAttemptsForQuestion(
	supabase: SupabaseClient,
	userId: string,
	questionId: string
): Promise<PracticeAttempt[]> {
	const { data } = await supabase
		.from("practice_attempts")
		.select(ATTEMPT_COLUMNS)
		.eq("user_id", userId)
		.eq("question_id", questionId)
		.order("created_at", { ascending: false })
		.limit(10);
	return ((data ?? []) as Row[]).map(toAttempt);
}

/** First instant of the current UTC month. */
export function startOfMonthUtc(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Practice answers that received AI feedback this calendar month (UTC). The pricing area
 * caps Free at FREE_FEEDBACK_PER_MONTH using this; it is not enforced here yet.
 */
export async function countFeedbackThisMonth(
	userId: string,
	supabase: SupabaseClient = createServerSupabase() as unknown as SupabaseClient,
	now: Date = new Date()
): Promise<number> {
	const { count, error } = await supabase
		.from("practice_attempts")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.not("feedback", "is", null)
		.gte("created_at", startOfMonthUtc(now).toISOString());
	if (error) throw new Error(error.message);
	return count ?? 0;
}

// ==================== INTERVIEWS ====================

export async function listInterviews(
	supabase: SupabaseClient,
	userId: string,
	since: Date
): Promise<InterviewCard[]> {
	const { data, error } = await supabase
		.from("interviews")
		.select(INTERVIEW_COLUMNS)
		.eq("user_id", userId)
		.gte("scheduled_at", since.toISOString())
		.order("scheduled_at", { ascending: true })
		.limit(50);
	if (error) throw new Error(error.message);
	return ((data ?? []) as Row[]).map(toInterview);
}

export async function createInterview(
	supabase: SupabaseClient,
	userId: string,
	input: Readonly<{
		companyId: string;
		scheduledAt: string;
		round: InterviewRound;
		companyType?: CompanyType | null;
		notes?: string;
	}>
): Promise<InterviewCard> {
	const { data, error } = await supabase
		.from("interviews")
		.insert({
			user_id: userId,
			company_id: input.companyId,
			scheduled_at: input.scheduledAt,
			round: input.round,
			company_type: input.companyType ?? null,
			checklist: defaultChecklist(input.round),
			notes: input.notes || null,
		})
		.select(INTERVIEW_COLUMNS)
		.single();
	if (error || !data) throw new Error(error?.message ?? "Could not save the interview");
	return toInterview(data as Row);
}

function interviewUpdate(patch: InterviewPatch): Row {
	const update: Row = {};
	if (patch.scheduledAt !== undefined) update.scheduled_at = patch.scheduledAt;
	if (patch.round !== undefined) update.round = patch.round;
	if (patch.companyType !== undefined) update.company_type = patch.companyType;
	if (patch.checklist !== undefined) update.checklist = patch.checklist;
	if (patch.notes !== undefined) update.notes = patch.notes || null;
	return update;
}

export async function updateInterview(
	supabase: SupabaseClient,
	userId: string,
	id: string,
	patch: InterviewPatch
): Promise<InterviewCard | null> {
	const { data, error } = await supabase
		.from("interviews")
		.update(interviewUpdate(patch))
		.eq("id", id)
		.eq("user_id", userId)
		.select(INTERVIEW_COLUMNS)
		.maybeSingle();
	if (error) throw new Error(error.message);
	return data ? toInterview(data as Row) : null;
}

export async function deleteInterview(supabase: SupabaseClient, userId: string, id: string): Promise<boolean> {
	const { data, error } = await supabase
		.from("interviews")
		.delete()
		.eq("id", id)
		.eq("user_id", userId)
		.select("id");
	if (error) throw new Error(error.message);
	return (data ?? []).length > 0;
}

/** The user's applications, for the interview form's company picker. */
export async function listCompanyOptions(
	supabase: SupabaseClient,
	userId: string
): Promise<{ id: string; name: string }[]> {
	const { data } = await supabase
		.from("companies")
		.select("id, name")
		.eq("user_id", userId)
		.order("updated_at", { ascending: false })
		.limit(200);
	return ((data ?? []) as Row[]).map((r) => ({ id: String(r.id), name: str(r.name) ?? "Untitled" }));
}
