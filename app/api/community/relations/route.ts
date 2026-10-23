import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJson } from "@/lib/api";
import { badRequest, serverError } from "@/lib/jobs/server";
import { isDuplicate, requireMember } from "@/lib/community/api";
import { relationSchema, type RelationInput } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RelationSpec = Readonly<{ table: string; self: string; other: string; on: boolean }>;

const RELATIONS: Readonly<Record<RelationInput["action"], RelationSpec>> = {
	follow: { table: "user_follows", self: "follower_id", other: "followee_id", on: true },
	unfollow: { table: "user_follows", self: "follower_id", other: "followee_id", on: false },
	mute: { table: "user_mutes", self: "muter_id", other: "muted_id", on: true },
	unmute: { table: "user_mutes", self: "muter_id", other: "muted_id", on: false },
	block: { table: "user_blocks", self: "blocker_id", other: "blocked_id", on: true },
	unblock: { table: "user_blocks", self: "blocker_id", other: "blocked_id", on: false },
};

async function applyRelation(supabase: SupabaseClient, userId: string, input: RelationInput) {
	const spec = RELATIONS[input.action];
	if (spec.on) {
		const { error } = await supabase.from(spec.table).insert({ [spec.self]: userId, [spec.other]: input.userId });
		return isDuplicate(error) ? null : error;
	}
	const { error } = await supabase.from(spec.table).delete().eq(spec.self, userId).eq(spec.other, input.userId);
	return error;
}

/** Blocking someone also stops following them. */
async function afterBlock(supabase: SupabaseClient, userId: string, input: RelationInput) {
	if (input.action !== "block") return;
	await supabase.from("user_follows").delete().eq("follower_id", userId).eq("followee_id", input.userId);
}

/** POST /api/community/relations { action: follow | unfollow | mute | unmute | block | unblock, userId } */
export async function POST(req: NextRequest) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, relationSchema);
	if (!parsed.success) return parsed.response;
	if (parsed.data.userId === auth.user.id) return badRequest("You can't do that to yourself");

	const error = await applyRelation(auth.supabase, auth.user.id, parsed.data);
	if (error) return serverError("Could not update this member", error);
	await afterBlock(auth.supabase, auth.user.id, parsed.data);
	return NextResponse.json({ ok: true });
}
