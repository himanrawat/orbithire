import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { suggestionActionSchema, uuidSchema } from "@/lib/milestones/schema";
import { acceptSuggestion, jsonError, loadPendingSuggestion, setSuggestionStatus } from "@/lib/milestones/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = Readonly<{ params: { id: string } }>;

/** POST /api/milestones/suggestions/:id { action: "accept" | "dismiss" } → { milestone? } */
export async function POST(req: NextRequest, context: RouteContext) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const id = uuidSchema.safeParse(context.params.id);
	if (!id.success) return jsonError("Suggestion not found", 404);
	const body = await parseJson(req, suggestionActionSchema);
	if (!body.success) return body.response;

	try {
		const suggestion = await loadPendingSuggestion(auth.supabase, auth.user.id, id.data);
		if (!suggestion) return jsonError("Suggestion not found", 404);
		if (body.data.action === "dismiss") {
			await setSuggestionStatus(auth.supabase, auth.user.id, suggestion.id, "dismissed");
			return NextResponse.json({ ok: true });
		}
		const milestone = await acceptSuggestion(auth.supabase, auth.user.id, suggestion);
		return NextResponse.json({ milestone }, { status: 201 });
	} catch (error) {
		console.error("[milestones] suggestion action failed:", error);
		return jsonError("Could not update the suggestion", 500);
	}
}
