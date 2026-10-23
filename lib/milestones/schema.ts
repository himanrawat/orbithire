/** Zod schemas for the milestones and public-profile API boundaries. */
import { z } from "zod";
import {
	DESCRIPTION_MAX,
	MILESTONE_KINDS,
	MILESTONE_VISIBILITIES,
	SUGGESTION_ACTIONS,
	TITLE_MAX,
	handleProblem,
	isDateOnly,
	normalizeHandle,
} from "./model";

const dateOnly = z.string().refine(isDateOnly, "Use a date like 2026-03-14");

const description = z
	.string()
	.trim()
	.max(DESCRIPTION_MAX)
	.transform((value) => (value === "" ? null : value))
	.nullable();

export const milestoneCreateSchema = z
	.object({
		kind: z.enum(MILESTONE_KINDS).default("other"),
		title: z.string().trim().min(1, "Add a title").max(TITLE_MAX),
		description: description.optional(),
		happened_on: dateOnly,
		visibility: z.enum(MILESTONE_VISIBILITIES).default("private"),
	})
	.strict();

export const milestoneUpdateSchema = z
	.object({
		kind: z.enum(MILESTONE_KINDS).optional(),
		title: z.string().trim().min(1, "Add a title").max(TITLE_MAX).optional(),
		description: description.optional(),
		happened_on: dateOnly.optional(),
		visibility: z.enum(MILESTONE_VISIBILITIES).optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Nothing to save");

export const suggestionActionSchema = z.object({ action: z.enum(SUGGESTION_ACTIONS) }).strict();

const handle = z
	.string()
	.max(64)
	.transform(normalizeHandle)
	.superRefine((value, ctx) => {
		const problem = handleProblem(value);
		if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
	});

export const publicSettingsSchema = z
	.object({
		public_handle: handle.nullable().optional(),
		public_profile_enabled: z.boolean().optional(),
		search_indexing: z.boolean().optional(),
		open_to_roles: z.boolean().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Nothing to save");

export const uuidSchema = z.string().uuid();

export type MilestoneCreate = z.infer<typeof milestoneCreateSchema>;
export type MilestoneUpdate = z.infer<typeof milestoneUpdateSchema>;
export type PublicSettingsUpdate = z.infer<typeof publicSettingsSchema>;
