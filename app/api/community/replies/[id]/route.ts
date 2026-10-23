import { NextResponse, type NextRequest } from "next/server";
import { serverError } from "@/lib/jobs/server";
import { invalidId, isUuid, notFound, requireMember } from "@/lib/community/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

/** DELETE /api/community/replies/:id – the author deletes their reply. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	if (!isUuid(params.id)) return invalidId();

	const { data, error } = await auth.supabase
		.from("community_replies")
		.delete()
		.eq("id", params.id)
		.eq("author_id", auth.user.id)
		.select("id");
	if (error) return serverError("Could not delete this reply", error);
	if (!data?.length) return notFound("Reply");
	return NextResponse.json({ deleted: true });
}
