/** Zod schemas for the prep API boundary and for stored JSON columns. Client-safe. */
import { z } from "zod";
import {
	COMPANY_TYPES,
	INPUT_MODES,
	INTERVIEW_ROUNDS,
	PREP_LEVELS,
	PREP_ROLES,
	PREP_STAGES,
	PREP_TOPICS,
	type ChecklistItem,
	type PrepFeedback,
} from "./constants";
import { MAX_CHECKLIST_ITEMS } from "./interviews";

/** Query-string filters for GET /api/prep/questions. Empty strings mean "any". */
export const questionFiltersSchema = z
	.object({
		role: z.enum(PREP_ROLES).optional(),
		topic: z.enum(PREP_TOPICS).optional(),
		level: z.enum(PREP_LEVELS).optional(),
		stage: z.enum(PREP_STAGES).optional(),
		companyType: z.enum(COMPANY_TYPES).optional(),
		mostAsked: z.boolean().optional(),
	})
	.strict();
export type QuestionFilters = z.infer<typeof questionFiltersSchema>;

const FILTER_KEYS = ["role", "topic", "level", "stage", "companyType"] as const;

/** Reads filters from URLSearchParams; returns null when a value is not allowed. */
export function parseQuestionFilters(params: URLSearchParams): QuestionFilters | null {
	const raw: Record<string, unknown> = {};
	for (const key of FILTER_KEYS) {
		const value = params.get(key);
		if (value) raw[key] = value;
	}
	if (params.get("mostAsked") === "true") raw.mostAsked = true;
	const parsed = questionFiltersSchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}

export const questionReportSchema = z
	.object({
		prompt: z.string().trim().min(10, "Write the question in at least 10 characters").max(1000),
		role: z.string().trim().max(120).optional(),
		companyType: z.enum(COMPANY_TYPES).optional(),
		questionId: z.string().uuid().optional(),
	})
	.strict();

export const attemptCreateSchema = z
	.object({
		questionId: z.string().uuid(),
		answerText: z.string().trim().min(1, "Write or record an answer first").max(10000),
		transcript: z.string().max(20000).optional(),
		inputMode: z.enum(INPUT_MODES),
		mockId: z.string().uuid().optional(),
	})
	.strict();
export type AttemptCreate = z.infer<typeof attemptCreateSchema>;

export const attemptPatchSchema = z.object({ flaggedWrong: z.literal(true) }).strict();

/** Strict shape the AI must return: exactly one strength, one gap, one next read. */
export const feedbackSchema = z
	.object({
		strength: z.string().trim().min(1).max(400),
		gap: z.string().trim().min(1).max(400),
		nextRead: z
			.object({
				title: z.string().trim().min(1).max(140),
				detail: z.string().trim().min(1).max(400),
			})
			.strict(),
	})
	.strict();

export function parseStoredFeedback(value: unknown): PrepFeedback | null {
	const parsed = feedbackSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

const checklistItemSchema = z
	.object({
		id: z.string().min(1).max(40),
		label: z.string().trim().min(1).max(200),
		done: z.boolean(),
	})
	.strict();
const checklistSchema = z.array(checklistItemSchema).max(MAX_CHECKLIST_ITEMS);

export function parseStoredChecklist(value: unknown): ChecklistItem[] {
	const parsed = z.array(checklistItemSchema.passthrough()).max(MAX_CHECKLIST_ITEMS).safeParse(value);
	if (!parsed.success) return [];
	return parsed.data.map(({ id, label, done }) => ({ id, label, done }));
}

export const interviewCreateSchema = z
	.object({
		companyId: z.string().uuid(),
		scheduledAt: z.string().datetime({ offset: true }),
		round: z.enum(INTERVIEW_ROUNDS),
		companyType: z.enum(COMPANY_TYPES).nullable().optional(),
		notes: z.string().max(5000).optional(),
	})
	.strict();

export const interviewPatchSchema = z
	.object({
		scheduledAt: z.string().datetime({ offset: true }).optional(),
		round: z.enum(INTERVIEW_ROUNDS).optional(),
		companyType: z.enum(COMPANY_TYPES).nullable().optional(),
		checklist: checklistSchema.optional(),
		notes: z.string().max(5000).nullable().optional(),
	})
	.strict()
	.refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type InterviewPatch = z.infer<typeof interviewPatchSchema>;
