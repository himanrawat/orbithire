import { NextRequest, NextResponse } from "next/server";
import { badRequest, parseSearchInput, requireUser, serverError } from "@/lib/jobs/server";

export const runtime = "nodejs";

// PATCH /api/jobs/searches/:id
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
	const { data: input, error: inputError } = parseSearchInput(body, true);
	if (inputError) return badRequest(inputError);
	if ("keywords" in input && !(input.keywords as string[]).length) {
		return badRequest("At least one search keyword is required");
	}
	const { data, error } = await auth.supabase
		.from("job_searches")
		.update(input)
		.eq("id", params.id)
		.eq("user_id", auth.user.id)
		.select("*")
		.maybeSingle();
	if (error) return serverError("Failed to update search", error);
	if (!data) return NextResponse.json({ error: "Search not found" }, { status: 404 });
	return NextResponse.json({ search: data });
}

// DELETE /api/jobs/searches/:id (matches keep existing; their search_id becomes NULL)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const { error } = await auth.supabase
		.from("job_searches")
		.delete()
		.eq("id", params.id)
		.eq("user_id", auth.user.id);
	if (error) return serverError("Failed to delete search", error);
	return NextResponse.json({ success: true });
}
