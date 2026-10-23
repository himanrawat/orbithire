/** Request schemas for the /api/community and /api/admin/community routes. No server imports. */
import { z } from "zod";
import {
	COMMUNITY_LIMITS,
	POST_TYPES,
	RELATION_ACTIONS,
	REPORT_REASONS,
	REPORT_TARGETS,
	TOPICS,
} from "./types";

const httpUrl = z
	.string()
	.trim()
	.max(COMMUNITY_LIMITS.urlLength)
	.url()
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "http:" || protocol === "https:";
	}, "Only http and https links are supported");

const title = z.string().trim().min(3, "Add a short title").max(COMMUNITY_LIMITS.titleLength);
const body = z.string().trim().max(COMMUNITY_LIMITS.bodyLength);

export const createPostSchema = z
	.object({
		type: z.enum(POST_TYPES),
		topic: z.enum(TOPICS),
		title,
		body: body.optional(),
		url: httpUrl.optional(),
	})
	.strict()
	.refine((value) => value.type !== "link" || !!value.url, {
		message: "Link posts need a link",
		path: ["url"],
	});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
	.object({
		topic: z.enum(TOPICS).optional(),
		title: title.optional(),
		body: body.optional(),
		url: httpUrl.nullable().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Nothing to update");
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const createReplySchema = z
	.object({ body: z.string().trim().min(1, "Write a reply first").max(COMMUNITY_LIMITS.replyLength) })
	.strict();

export const toggleSchema = z.object({ kind: z.enum(["helpful", "save"]), on: z.boolean() }).strict();
export type ToggleInput = z.infer<typeof toggleSchema>;

export const reportSchema = z
	.object({
		targetType: z.enum(REPORT_TARGETS),
		targetId: z.string().uuid(),
		reason: z.enum(REPORT_REASONS),
		details: z.string().trim().max(COMMUNITY_LIMITS.reportDetailsLength).optional(),
	})
	.strict();
export type ReportInput = z.infer<typeof reportSchema>;

export const relationSchema = z
	.object({ action: z.enum(RELATION_ACTIONS), userId: z.string().uuid() })
	.strict();
export type RelationInput = z.infer<typeof relationSchema>;

export const viewsSchema = z
	.object({ postIds: z.array(z.string().uuid()).min(1).max(COMMUNITY_LIMITS.viewBatch) })
	.strict();

export const joinSchema = z
	.object({
		code: z
			.string()
			.trim()
			.min(6, "Enter your invite code")
			.max(24)
			.regex(/^[A-Za-z0-9]+$/, "Invite codes use letters and numbers only"),
	})
	.strict();

export const inviteRequestSchema = z
	.object({ note: z.string().trim().max(COMMUNITY_LIMITS.requestNoteLength).optional() })
	.strict();

export const idSchema = z.string().uuid();

// ==================== Admin ====================

export const MODERATION_ACTIONS = ["hide", "dismiss", "suspend"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const moderationActionSchema = z
	.object({
		action: z.enum(MODERATION_ACTIONS),
		note: z.string().trim().max(500).optional(),
	})
	.strict();

export const createInviteSchema = z
	.object({
		maxUses: z.number().int().min(1).max(1000),
		expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
		field: z.string().trim().min(2).max(80).optional(),
	})
	.strict();
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const communitySettingsSchema = z
	.object({ launchField: z.string().trim().min(2).max(80) })
	.strict();
