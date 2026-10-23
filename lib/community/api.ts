import "server-only";

/** Small shared pieces for the /api/community route handlers. */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/jobs/server";
import { requireActiveMember, type MemberAuth } from "./server";
import { idSchema } from "./schema";

/** Signed-in user who is an active community member, or an error response. */
export async function requireMember(): Promise<MemberAuth> {
	const auth = await requireUser();
	if (auth.error) return { error: auth.error };
	return requireActiveMember(auth.supabase, auth.user);
}

export function notFound(what = "Post") {
	return NextResponse.json({ error: `${what} not found` }, { status: 404 });
}

export function invalidId() {
	return NextResponse.json({ error: "Invalid id" }, { status: 400 });
}

export function isUuid(value: unknown): value is string {
	return idSchema.safeParse(value).success;
}

/** Postgres unique_violation: the row already exists, which these toggles treat as success. */
export function isDuplicate(error: { code?: string } | null | undefined) {
	return error?.code === "23505";
}
