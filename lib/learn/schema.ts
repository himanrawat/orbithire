/** Request schemas for the /api/learn routes. No server imports. */
import { z } from "zod";
import { LEARN_LIMITS, PROGRESS_STATUSES, VISIBILITIES } from "./types";

const tags = z.array(z.string().max(LEARN_LIMITS.tagLength)).max(LEARN_LIMITS.tags);

const httpUrl = z
	.string()
	.trim()
	.max(LEARN_LIMITS.urlLength)
	.url()
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	}, "Only http and https links are supported");

const linkEntry = z
	.object({
		kind: z.literal("link"),
		url: httpUrl,
		title: z.string().trim().max(LEARN_LIMITS.titleLength).optional(),
		note: z.string().trim().max(LEARN_LIMITS.noteLength).optional(),
		tags: tags.optional(),
	})
	.strict();

const noteEntry = z
	.object({
		kind: z.literal("note"),
		title: z.string().trim().max(LEARN_LIMITS.titleLength).optional(),
		note: z.string().trim().min(1, "Write a note first").max(LEARN_LIMITS.noteLength),
		tags: tags.optional(),
	})
	.strict();

export const createEntrySchema = z.discriminatedUnion("kind", [linkEntry, noteEntry]);
export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const updateEntrySchema = z
	.object({
		visibility: z.enum(VISIBILITIES).optional(),
		title: z.string().trim().max(LEARN_LIMITS.titleLength).optional(),
		note: z.string().trim().max(LEARN_LIMITS.noteLength).optional(),
		tags: tags.optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Nothing to update");
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;

export const progressSchema = z
	.object({
		lessonId: z.string().uuid(),
		status: z.enum(PROGRESS_STATUSES),
	})
	.strict();
export type ProgressInput = z.infer<typeof progressSchema>;

export const entryIdSchema = z.string().uuid();
