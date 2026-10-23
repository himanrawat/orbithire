import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import {
	clearAdminSessionCookie,
	logAdminActivity,
	requireAdmin,
	revokeAdminSessions,
} from "@/lib/adminAuth";
import bcrypt from "bcryptjs";
import { parseJson } from "@/lib/api";
import { passwordChangeSchema } from "@/lib/schemas/admin";

// Saves the new hash and clears the forced-change flag set for temporary passwords.
async function savePassword(adminId: string, newPassword: string) {
	const now = new Date().toISOString();
	const { error } = await createServiceSupabase()
		.from("admin_users")
		.update({
			password_hash: await bcrypt.hash(newPassword, 12),
			must_change_password: false,
			password_changed_at: now,
			updated_at: now,
		})
		.eq("id", adminId);
	return error;
}

export async function POST(req: NextRequest) {
	try {
		// Every role, including an admin still on a temporary password, can change their own.
		const admin = await requireAdmin({ minRole: "moderator", allowPasswordChangePending: true });
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(req, passwordChangeSchema);
		if (!parsed.success) return parsed.response;
		const { currentPassword, newPassword } = parsed.data;

		const isValidPassword = await bcrypt.compare(currentPassword, admin.password_hash);
		if (!isValidPassword) {
			return NextResponse.json(
				{ error: "Current password is incorrect" },
				{ status: 400 }
			);
		}

		if (currentPassword === newPassword) {
			return NextResponse.json(
				{ error: "Choose a password you haven't used here before" },
				{ status: 400 }
			);
		}

		const error = await savePassword(admin.id, newPassword);
		if (error) {
			console.error("Error updating password:", error);
			return NextResponse.json(
				{ error: "Failed to update password" },
				{ status: 500 }
			);
		}

		await logAdminActivity(admin.id, "change_password", {
			details: { was_temporary: admin.must_change_password },
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
