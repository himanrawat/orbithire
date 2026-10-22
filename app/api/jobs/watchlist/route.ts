import { NextRequest, NextResponse } from "next/server";
import { badRequest, parseWatchedInput, requireUser, serverError } from "@/lib/jobs/server";
import { detectAts } from "@/lib/jobs/portals";
import { parseJson } from "@/lib/api";
import { watchedCompanyCreateSchema } from "@/lib/schemas/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/watchlist – watched companies (ATS boards).
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { data, error } = await auth.supabase
		.from("watched_companies")
		.select("id,user_id,company,ats,board_token,careers_url,enabled,created_at,updated_at")
		.eq("user_id", auth.user.id)
		.order("company", { ascending: true });
	if (error) return serverError("Failed to load watchlist", error);
	return NextResponse.json({ companies: data || [] });
}

// POST /api/jobs/watchlist – add a watched company. `ats` / `board_token` may be
// omitted when `careers_url` is a recognisable board URL (detectAts).
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, watchedCompanyCreateSchema);
	if (!parsed.success) return parsed.response;
	const body: Record<string, unknown> = { ...parsed.data };
	if (body.careers_url && (!body.ats || !body.board_token)) {
		const d = detectAts(String(body.careers_url));
		if (d.ats && d.token) {
			body.ats = d.ats;
			body.board_token = d.token;
		}
	}
	const { data: input, error: inputError } = parseWatchedInput(body, false);
	if (inputError) return badRequest(inputError);
	const { data, error } = await auth.supabase
		.from("watched_companies")
		.insert({ ...input, user_id: auth.user.id })
		.select("id,user_id,company,ats,board_token,careers_url,enabled,created_at,updated_at")
		.single();
	if (error) {
		if (error.code === "23505") return badRequest("This board is already on your watchlist");
		return serverError("Failed to add company", error);
	}
	return NextResponse.json({ company: data }, { status: 201 });
}
