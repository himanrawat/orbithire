import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function POST() {
	try {
		const supabase = createServerSupabase();
		await supabase.auth.signOut();

		return NextResponse.json({ success: true });
	} catch {
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
