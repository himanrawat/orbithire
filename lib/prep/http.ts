/** Small response helpers shared by the /api/prep routes. Server-only. */
import { NextResponse } from "next/server";
import { z } from "zod";

const uuidSchema = z.string().uuid();

export function isUuid(value: string): boolean {
	return uuidSchema.safeParse(value).success;
}

export function notFound(what: string) {
	return NextResponse.json({ error: `${what} not found` }, { status: 404 });
}

/** Logs the real error and returns a generic 500 with a user-facing message. */
export function serverError(scope: string, error: unknown, message: string) {
	console.error(`[prep] ${scope}:`, error);
	return NextResponse.json({ error: message }, { status: 500 });
}
