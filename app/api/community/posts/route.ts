import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { serverError } from "@/lib/jobs/server";
import { requireMember } from "@/lib/community/api";
import { enforceCommunityLimit } from "@/lib/community/server";
import { createPostSchema, type CreatePostInput } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildInsert(authorId: string, input: CreatePostInput) {
	return {
		author_id: authorId,
		type: input.type,
		topic: input.topic,
		title: input.title,
		body: input.body ?? "",
		url: input.url ?? null,
	};
}

/** POST /api/community/posts – share a milestone, learning, question or link. */
export async function POST(req: NextRequest) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, createPostSchema);
	if (!parsed.success) return parsed.response;
	const limited = await enforceCommunityLimit("post", auth.user, auth.member);
	if (limited) return limited;

	const { data, error } = await auth.supabase
		.from("community_posts")
		.insert(buildInsert(auth.user.id, parsed.data))
		.select("id")
		.single();
	if (error) return serverError("Could not publish this post", error);
	return NextResponse.json({ id: data.id }, { status: 201 });
}
