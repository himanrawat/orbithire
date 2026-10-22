import { z } from "zod";

const uuid = z.string().uuid();
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export const accessCodeSchema = z.object({
	expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
}).strict();

export const adminActionSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("create"),
		name: z.string().trim().min(1).max(120),
		email,
		password: z.string().min(8).max(256),
	}).strict(),
	z.object({ action: z.literal("delete"), adminId: uuid }).strict(),
]);

export const contactStatusSchema = z.object({
	contactId: uuid,
	status: z.enum(["new", "read", "replied", "archived"]),
}).strict();

export const creditsActionSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("add_credits"),
		userId: uuid,
		amount: z.coerce.number().int().min(1).max(100_000),
	}).strict(),
	z.object({
		action: z.literal("set_unlimited"),
		userId: uuid,
		unlimited: z.boolean(),
		expiresAt: z.string().datetime().nullable().optional(),
	}).strict(),
]);

export const passwordChangeSchema = z.object({
	currentPassword: z.string().min(1).max(256),
	newPassword: z.string().min(8).max(256),
}).strict();

export const enqueueTaskSchema = z.object({
	type: z.literal("noop").optional(),
	payload: z.object({ fail: z.boolean().optional() }).strict().optional(),
}).strict();

export const retryTaskSchema = z.object({ taskId: uuid }).strict();
export const deleteUserSchema = z.object({ userId: uuid }).strict();
export const emailPermissionSchema = z.object({ userId: uuid, canChangeEmail: z.boolean() }).strict();
export const adminEmailSchema = z.object({
	userId: uuid,
	newEmail: email,
	requireVerification: z.boolean().optional(),
}).strict();
