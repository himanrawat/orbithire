import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseJson } from "@/lib/api";
import { updateBlockSchema } from "@/lib/focus/schemas";
import { deleteBlock, getBlock, linkGoogleEvent, readTimeZone, updateBlock } from "@/lib/focus/blocks";
import { requireUser } from "@/lib/focus/server";
import { pushBlockToGoogle, removeBlockFromGoogle } from "@/lib/calendar/google/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = Readonly<{ params: { id: string } }>;

const idSchema = z.string().uuid();

function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function notFound() {
	return NextResponse.json({ error: "Block not found" }, { status: 404 });
}

/** PATCH /api/schedule/blocks/:id { kind?, title?, starts_at?, ends_at? } – edit or move a block */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	if (!idSchema.safeParse(params.id).success) return notFound();
	const parsed = await parseJson(req, updateBlockSchema);
	if (!parsed.success) return parsed.response;
	if (Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

	try {
		const block = await updateBlock(auth.supabase, auth.userId, params.id, parsed.data);
		if (!block) return notFound();
		const eventId = await pushBlockToGoogle(auth.userId, block, readTimeZone(req.headers));
		return NextResponse.json({ block: await linkGoogleEvent(auth.supabase, auth.userId, block, eventId) });
	} catch {
		return NextResponse.json({ error: "Could not save the block" }, { status: 500 });
	}
}

/** DELETE /api/schedule/blocks/:id – removes the block and its Google event */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	if (!idSchema.safeParse(params.id).success) return notFound();

	const block = await getBlock(auth.supabase, auth.userId, params.id);
	if (!block) return notFound();
	try {
		await deleteBlock(auth.supabase, auth.userId, block.id);
	} catch {
		return NextResponse.json({ error: "Could not delete the block" }, { status: 500 });
	}
	await removeBlockFromGoogle(auth.userId, block.google_event_id);
	return NextResponse.json({ ok: true });
}
