import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { badRequest, requireUser, serverError } from "@/lib/jobs/server";
import { buildEntryUpdate } from "@/lib/learn/entries";
import { entryIdSchema, updateEntrySchema } from "@/lib/learn/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const ENTRY_COLUMNS = "id, kind, url, title, note, tags, visibility, created_at";

function notFound() {
	return NextResponse.json({ error: "Entry not found" }, { status: 404 });
}

/** PATCH /api/learn/entries/:id – edit title, note or tags, or share to profile (visibility). */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!entryIdSchema.safeParse(params.id).success) return badRequest("Invalid entry id");
	const parsed = await parseJson(req, updateEntrySchema);
	if (!parsed.success) return parsed.response;

	const { data, error } = await auth.supabase
		.from("learning_entries")
		.update(buildEntryUpdate(parsed.data))
		.eq("id", params.id)
		.eq("user_id", auth.user.id)
		.select(ENTRY_COLUMNS)
		.maybeSingle();
	if (error) return serverError("Could not update this entry", error);
	if (!data) return notFound();
	return NextResponse.json({ entry: data });
}

/** DELETE /api/learn/entries/:id */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	if (!entryIdSchema.safeParse(params.id).success) return badRequest("Invalid entry id");

	const { data, error } = await auth.supabase
		.from("learning_entries")
		.delete()
		.eq("id", params.id)
		.eq("user_id", auth.user.id)
		.select("id");
	if (error) return serverError("Could not delete this entry", error);
	if (!data || data.length === 0) return notFound();
	return NextResponse.json({ ok: true });
}
