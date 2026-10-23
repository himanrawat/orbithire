import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireMember } from "@/lib/community/api";
import { viewsSchema } from "@/lib/community/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/community/views { postIds } – one view per (post, viewer); feeds For you ranking. */
export async function POST(req: NextRequest) {
	const auth = await requireMember();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, viewsSchema);
	if (!parsed.success) return parsed.response;

	const { data, error } = await auth.supabase.rpc("community_record_views", { p_post_ids: parsed.data.postIds });
	if (error) {
		console.error("[community] record views failed:", error.message);
		return NextResponse.json({ recorded: 0 });
	}
	return NextResponse.json({ recorded: typeof data === "number" ? data : 0 });
}
