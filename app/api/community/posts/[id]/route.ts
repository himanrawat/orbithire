import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { serverError } from "@/lib/jobs/server";
import { invalidId, isUuid, notFound, requireMember } from "@/lib/community/api";
import { updatePostSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

/** PATCH /api/community/posts/:id – the author edits title, body, link or topic. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return invalidId();
	const parsed = await parseJson(req, updatePostSchema);
	if (!parsed.success) return parsed.response;

	const { data, error } = await auth.supabase
		.from("community_posts")
		.update(parsed.data)
		.eq("id", params.id)
		.eq("author_id", auth.user.id)
		.select("id")
		.maybeSingle();
	if (error) return serverError("Could not update this post", error);
	if (!data) return notFound();
	return NextResponse.json({ id: data.id });
}

/** DELETE /api/community/posts/:id – the author deletes their post. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return invalidId();

	const { data, error } = await auth.supabase
		.from("community_posts")
		.delete()
		.eq("id", params.id)
		.eq("author_id", auth.user.id)
		.select("id");
	if (error) return serverError("Could not delete this post", error);
	if (!data?.length) return notFound();
	return NextResponse.json({ deleted: true });
}
