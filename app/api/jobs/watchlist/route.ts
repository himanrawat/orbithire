import { NextRequest, NextResponse } from "next/server";
import { badRequest, parseWatchedInput, requireUser, serverError } from "@/lib/jobs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs/watchlist – watched companies (ATS boards).
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { data, error } = await auth.supabase
		.from("watched_companies")
		.select("*")
		.eq("user_id", auth.user.id)
		.order("company", { ascending: true });
	if (error) return serverError("Failed to load watchlist", error);
	return NextResponse.json({ companies: data || [] });
}

// POST /api/jobs/watchlist – add a watched company.
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
	const { data: input, error: inputError } = parseWatchedInput(body, false);
	if (inputError) return badRequest(inputError);
	const { data, error } = await auth.supabase
		.from("watched_companies")
		.insert({ ...input, user_id: auth.user.id })
		.select("*")
		.single();
	if (error) {
		if (error.code === "23505") return badRequest("This board is already on your watchlist");
		return serverError("Failed to add company", error);
	}
	return NextResponse.json({ company: data }, { status: 201 });
}
