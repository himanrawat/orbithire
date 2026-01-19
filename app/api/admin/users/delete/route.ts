import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";

async function verifyAdmin() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token");

	if (!adminToken) {
		return null;
	}

	const supabase = createServiceSupabase();
	const { data: admin } = await supabase
		.from("admin_users")
		.select("id, email, name")
		.eq("id", adminToken.value)
		.eq("is_active", true)
		.single();

	return admin;
}

export async function POST(req: NextRequest) {
	try {
		const admin = await verifyAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { userId } = await req.json();
		if (!userId) {
			return NextResponse.json(
				{ error: "User ID is required" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		// Delete auth user (also cascades profile if FK is set to cascade)
		const { error: authError } = await supabase.auth.admin.deleteUser(userId);
		if (authError) {
			console.error("Admin delete user auth error:", authError);
			return NextResponse.json(
				{ error: "Failed to delete user from auth" },
				{ status: 500 }
			);
		}

		// Best-effort cleanup of profile row if it still exists (in case cascade is not set)
		await supabase.from("profiles").delete().eq("id", userId);

		// Log admin activity
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "delete_user",
			target_type: "user",
			target_id: userId,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Admin delete user error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
