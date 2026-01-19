import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

async function verifyAdmin() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token");

	if (!adminToken) {
		return null;
	}

	const supabase = createServiceSupabase();
	const { data: admin } = await supabase
		.from("admin_users")
		.select("id, email, name, password_hash")
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

		const { currentPassword, newPassword } = await req.json();

		if (!currentPassword || !newPassword) {
			return NextResponse.json(
				{ error: "Current and new passwords are required" },
				{ status: 400 }
			);
		}

		if (newPassword.length < 8) {
			return NextResponse.json(
				{ error: "Password must be at least 8 characters" },
				{ status: 400 }
			);
		}

		// Verify current password
		const isValidPassword = await bcrypt.compare(currentPassword, admin.password_hash);
		if (!isValidPassword) {
			return NextResponse.json(
				{ error: "Current password is incorrect" },
				{ status: 400 }
			);
		}

		// Hash new password
		const newPasswordHash = await bcrypt.hash(newPassword, 12);

		const supabase = createServiceSupabase();

		const { error } = await supabase
			.from("admin_users")
			.update({
				password_hash: newPasswordHash,
				updated_at: new Date().toISOString(),
			})
			.eq("id", admin.id);

		if (error) {
			console.error("Error updating password:", error);
			return NextResponse.json(
				{ error: "Failed to update password" },
				{ status: 500 }
			);
		}

		// Log admin activity
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "change_password",
			target_type: "admin",
			target_id: admin.id,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Password change error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
