/**
 * Account deletion helpers that do not touch the network (PRD area 11).
 * The server side lives in lib/account/server.ts.
 */
import { z } from "zod";

/** S3/R2 DeleteObjects accepts at most 1000 keys per request. */
export const R2_DELETE_BATCH_SIZE = 1000;

export const accountDeleteSchema = z
	.object({
		confirmEmail: z.string().trim().min(3).max(254),
	})
	.strict();

export type AccountDeleteBody = z.infer<typeof accountDeleteSchema>;

/** The user must type the email they sign in with; case and spaces do not matter. */
export function confirmationMatches(
	typed: string,
	accountEmail: string | null | undefined
): boolean {
	if (!accountEmail) return false;
	return typed.trim().toLowerCase() === accountEmail.trim().toLowerCase();
}

/** Every file a user owns lives under "<userId>/" in the bucket. */
export function userStoragePrefix(userId: string): string {
	if (!z.string().uuid().safeParse(userId).success) {
		throw new Error("userStoragePrefix: expected a user UUID");
	}
	return `${userId}/`;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
	if (size < 1) throw new Error("chunk: size must be >= 1");
	const batches: T[][] = [];
	for (let start = 0; start < items.length; start += size) {
		batches.push(items.slice(start, start + size));
	}
	return batches;
}
