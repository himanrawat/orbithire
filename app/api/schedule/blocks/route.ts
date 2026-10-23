import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { createBlockSchema, parseRange } from "@/lib/focus/schemas";
import { insertBlock, linkGoogleEvent, listBlocks, readTimeZone } from "@/lib/focus/blocks";
import { requireUser } from "@/lib/focus/server";
import { pushBlockToGoogle } from "@/lib/calendar/google/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** GET /api/schedule/blocks?start=ISO&end=ISO → { blocks } overlapping the range */
export async function GET(req: NextRequest) {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	const range = parseRange(req.nextUrl.searchParams);
	if (!range) return NextResponse.json({ error: "Send a start and end of at most 6 weeks" }, { status: 400 });
	try {
		return NextResponse.json({ blocks: await listBlocks(auth.supabase, auth.userId, range) });
	} catch {
		return NextResponse.json({ error: "Could not load your schedule" }, { status: 500 });
	}
}

/** POST /api/schedule/blocks { kind, title, starts_at, ends_at } → { block }, pushed to Google when connected */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (!auth) return unauthorized();
	const parsed = await parseJson(req, createBlockSchema);
	if (!parsed.success) return parsed.response;
	try {
		const block = await insertBlock(auth.supabase, auth.userId, parsed.data);
		const eventId = await pushBlockToGoogle(auth.userId, block, readTimeZone(req.headers));
		return NextResponse.json({ block: await linkGoogleEvent(auth.supabase, auth.userId, block, eventId) }, { status: 201 });
	} catch {
		return NextResponse.json({ error: "Could not save the block" }, { status: 500 });
	}
}
