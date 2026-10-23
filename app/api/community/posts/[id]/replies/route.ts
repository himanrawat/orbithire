import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { serverError } from "@/lib/jobs/server";
import { invalidId, isUuid, notFound, requireMember } from "@/lib/community/api";
import { enforceCommunityLimit } from "@/lib/community/server";
import { createReplySchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

/** POST /api/community/posts/:id/replies { body } */
export async function POST(req: NextRequest, { params }: RouteContext) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return invalidId();
	const parsed = await parseJson(req, createReplySchema);
	if (!parsed.success) return parsed.response;
	const limited = await enforceCommunityLimit("reply", auth.user, auth.member);
	if (limited) return limited;

	const { data, error } = await auth.supabase
		.from("community_replies")
		.insert({ post_id: params.id, author_id: auth.user.id, body: parsed.data.body })
		.select("id")
		.single();
	// RLS rejects replies to posts the member can't see (42501): report it as not found.
	if (error?.code === "42501") return notFound();
	if (error) return serverError("Could not post your reply", error);
	return NextResponse.json({ id: data.id }, { status: 201 });
}
