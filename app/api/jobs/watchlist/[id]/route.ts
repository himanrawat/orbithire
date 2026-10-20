import { NextRequest, NextResponse } from "next/server";
import { badRequest, parseWatchedInput, requireUser, serverError } from "@/lib/jobs/server";

export const runtime = "nodejs";

// PATCH /api/jobs/watchlist/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
	const { data: input, error: inputError } = parseWatchedInput(body, true);
	if (inputError) return badRequest(inputError);
	const { data, error } = await auth.supabase
		.from("watched_companies")
		.update(input)
		.eq("id", params.id)
		.eq("user_id", auth.user.id)
		.select("*")
		.maybeSingle();
	if (error) {
		if (error.code === "23505") return badRequest("This board is already on your watchlist");
		return serverError("Failed to update company", error);
	}
	if (!data) return NextResponse.json({ error: "Company not found" }, { status: 404 });
	return NextResponse.json({ company: data });
}

// DELETE /api/jobs/watchlist/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { error } = await auth.supabase
		.from("watched_companies")
		.delete()
		.eq("id", params.id)
		.eq("user_id", auth.user.id);
	if (error) return serverError("Failed to delete company", error);
	return NextResponse.json({ success: true });
}
