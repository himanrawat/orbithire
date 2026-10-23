/** Request schemas for the PWA and push routes. No server imports. */
import { z } from "zod";
import { createEntrySchema, type CreateEntryInput } from "@/lib/learn/schema";
import { PUSH_PLATFORMS } from "./platform";

const base64Url = z
	.string()
	.min(1)
	.regex(/^[\w-]+=*$/, "Expected a base64url value");

export const pushSubscriptionSchema = z
	.object({
		endpoint: z
			.string()
			.max(2048)
			.url()
			.refine((value) => value.startsWith("https://"), "Push endpoints must use https"),
		keys: z
			.object({
				p256dh: base64Url.max(256),
				auth: base64Url.max(64),
			})
			.strict(),
		platform: z.enum(PUSH_PLATFORMS),
	})
	.strict();
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z
	.object({
		endpoint: z.string().max(2048).url(),
		platform: z.enum(PUSH_PLATFORMS),
	})
	.strict();

export const pushEventSchema = z
	.object({
		platform: z.enum(PUSH_PLATFORMS),
		event: z.literal("denied"),
	})
	.strict();

export const NOTIFICATION_PREFERENCE_KEYS = ["morning_plan", "follow_ups", "interviews", "email_fallback"] as const;
export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
	morning_plan: true,
	follow_ups: true,
	interviews: true,
	email_fallback: true,
};

export const notificationPreferencesSchema = z
	.object({
		morning_plan: z.boolean().optional(),
		follow_ups: z.boolean().optional(),
		interviews: z.boolean().optional(),
		email_fallback: z.boolean().optional(),
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, "Nothing to update");

/** Stored preferences row (or null) → a full set with defaults. */
export function withPreferenceDefaults(row: Partial<Record<string, unknown>> | null | undefined): NotificationPreferences {
	const result = { ...DEFAULT_NOTIFICATION_PREFERENCES };
	for (const key of NOTIFICATION_PREFERENCE_KEYS) {
		const value = row?.[key];
		if (typeof value === "boolean") result[key] = value;
	}
	return result;
}

/** One offline log entry: a normal learning entry plus the browser's idempotency key. */
export type QueuedLogEntry = CreateEntryInput & { client_id: string };

const clientIdSchema = z.string().uuid();

/** Validates a queued entry (the entry schemas are strict, so client_id is split off first). */
export function parseQueuedLogEntry(value: unknown): QueuedLogEntry | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const { client_id: clientId, ...entry } = value as Record<string, unknown>;
	const id = clientIdSchema.safeParse(clientId);
	const parsed = createEntrySchema.safeParse(entry);
	if (!id.success || !parsed.success) return null;
	return { ...parsed.data, client_id: id.data };
}

export const logEntryBatchSchema = z
	.object({
		entries: z.array(z.unknown()).max(50),
	})
	.strict();
