import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { learningEntrySchema } from "@/lib/today/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/today/learning – quick learning-log entry from Today.
 * Writes a private note to Learn's `learning_entries` (area 3); 501 if that table is missing.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await parseJson(req, learningEntrySchema);
	if (!body.success) return body.response;
	const { error } = await auth.supabase
		.from("learning_entries")
		.insert({ user_id: auth.user.id, kind: "note", note: body.data.note });
	if (error) {
		console.error("[today] learning entry failed:", error);
		return NextResponse.json({ error: "The learning log isn't available yet" }, { status: 501 });
	}
	return NextResponse.json({ ok: true }, { status: 201 });
}
