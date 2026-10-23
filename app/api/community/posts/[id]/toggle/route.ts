import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJson } from "@/lib/api";
import { serverError } from "@/lib/jobs/server";
import { invalidId, isDuplicate, isUuid, notFound, requireMember } from "@/lib/community/api";
import { toggleSchema, type ToggleInput } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const TABLES: Readonly<Record<ToggleInput["kind"], string>> = {
	helpful: "post_reactions",
	save: "post_saves",
};

async function applyToggle(supabase: SupabaseClient, userId: string, postId: string, input: ToggleInput) {
	const table = TABLES[input.kind];
	if (input.on) {
		const { error } = await supabase.from(table).insert({ post_id: postId, user_id: userId });
		return isDuplicate(error) ? null : error;
	}
	const { error } = await supabase.from(table).delete().eq("post_id", postId).eq("user_id", userId);
	return error;
}

async function helpfulCount(supabase: SupabaseClient, postId: string) {
	const { data } = await supabase.from("community_posts").select("helpful_count").eq("id", postId).maybeSingle();
	return typeof data?.helpful_count === "number" ? data.helpful_count : null;
}

/** POST /api/community/posts/:id/toggle { kind: helpful | save, on } */
export async function POST(req: NextRequest, { params }: RouteContext) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return invalidId();
	const parsed = await parseJson(req, toggleSchema);
	if (!parsed.success) return parsed.response;

	const error = await applyToggle(auth.supabase, auth.user.id, params.id, parsed.data);
	if (error?.code === "42501") return notFound();
	if (error) return serverError("Could not update this post", error);
	return NextResponse.json({ on: parsed.data.on, helpfulCount: await helpfulCount(auth.supabase, params.id) });
}
