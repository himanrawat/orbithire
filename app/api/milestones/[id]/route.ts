import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { milestoneUpdateSchema, uuidSchema } from "@/lib/milestones/schema";
import { deleteMilestone, jsonError, updateMilestone } from "@/lib/milestones/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = Readonly<{ params: { id: string } }>;

function parseId(context: RouteContext): string | null {
	const parsed = uuidSchema.safeParse(context.params.id);
	return parsed.success ? parsed.data : null;
}

/** PATCH /api/milestones/:id → { milestone } (edit fields or flip visibility). */
export async function PATCH(req: NextRequest, context: RouteContext) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const id = parseId(context);
	if (!id) return jsonError("Milestone not found", 404);
	const body = await parseJson(req, milestoneUpdateSchema);
	if (!body.success) return body.response;
	try {
		const milestone = await updateMilestone(auth.supabase, auth.user.id, id, body.data);
		if (!milestone) return jsonError("Milestone not found", 404);
		return NextResponse.json({ milestone });
	} catch (error) {
		console.error("[milestones] update failed:", error);
		return jsonError("Could not save the milestone", 500);
	}
}

/** DELETE /api/milestones/:id → { ok: true } */
export async function DELETE(_req: NextRequest, context: RouteContext) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const id = parseId(context);
	if (!id) return jsonError("Milestone not found", 404);
	try {
		const deleted = await deleteMilestone(auth.supabase, auth.user.id, id);
		if (!deleted) return jsonError("Milestone not found", 404);
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[milestones] delete failed:", error);
		return jsonError("Could not delete the milestone", 500);
	}
}
