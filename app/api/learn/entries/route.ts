import { NextResponse, type NextRequest } from "next/server";
import { parseJson } from "@/lib/api";
import { requireUser, serverError } from "@/lib/jobs/server";
import { enforceRateLimit } from "@/lib/requestSecurity";
import { buildEntryInsert, needsTitleFetch } from "@/lib/learn/entries";
import { fetchPageTitle } from "@/lib/learn/fetchTitle";
import { createEntrySchema, type CreateEntryInput } from "@/lib/learn/schema";
import { loadEntries } from "@/lib/learn/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTRY_COLUMNS = "id, kind, url, title, note, tags, visibility, created_at";

/** GET /api/learn/entries → { entries } (newest first, the caller's own). */
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	try {
		return NextResponse.json({ entries: await loadEntries(auth.supabase, auth.user.id) });
	} catch (error) {
		return serverError("Could not load your learning log", error);
	}
}

async function titleFor(req: NextRequest, userId: string, input: CreateEntryInput) {
	if (!needsTitleFetch(input) || input.kind !== "link") return { title: null, limited: null };
	const limited = await enforceRateLimit(req, {
		scope: "learn.title_fetch",
		limit: 60,
		windowSeconds: 3600,
		identifier: userId,
	});
	if (limited) return { title: null, limited };
	return { title: await fetchPageTitle(input.url), limited: null };
}

/**
 * POST /api/learn/entries – log a link or a note. Links without a title get the page's
 * <title>, fetched server-side with SSRF guards. Entries start private.
 */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, createEntrySchema);
	if (!parsed.success) return parsed.response;

	const { title, limited } = await titleFor(req, auth.user.id, parsed.data);
	if (limited) return limited;

	const { data, error } = await auth.supabase
		.from("learning_entries")
		.insert(buildEntryInsert(auth.user.id, parsed.data, title))
		.select(ENTRY_COLUMNS)
		.single();
	if (error) return serverError("Could not save this entry", error);
	return NextResponse.json({ entry: data }, { status: 201 });
}
