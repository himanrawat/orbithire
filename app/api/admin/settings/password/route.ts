import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { clearAdminSessionCookie, requireAdmin, revokeAdminSessions } from "@/lib/adminAuth";
import bcrypt from "bcryptjs";
import { parseJson } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/schemas/admin";

export async function POST(req: NextRequest) {
	try {
		const admin = await requireAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(req, passwordChangeSchema);
		if (!parsed.success) return parsed.response;
		const { currentPassword, newPassword } = parsed.data;

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

		// A password change revokes every existing device session.
		await revokeAdminSessions(admin.id);
		clearAdminSessionCookie();

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Password change error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
