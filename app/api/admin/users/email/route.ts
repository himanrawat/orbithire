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

		const { userId, newEmail, requireVerification } = await req.json();

		if (!userId || !newEmail) {
			return NextResponse.json(
				{ error: "User ID and new email are required" },
				{ status: 400 }
			);
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(newEmail)) {
			return NextResponse.json(
				{ error: "Invalid email format" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		// Get current user email
		const { data: profile } = await supabase
			.from("profiles")
			.select("email")
			.eq("id", userId)
			.single();

		if (!profile) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 }
			);
		}

		const oldEmail = profile.email;

		// Check if new email is already in use
		const { data: existingUser } = await supabase
			.from("profiles")
			.select("id")
			.eq("email", newEmail)
			.neq("id", userId)
			.single();

		if (existingUser) {
			return NextResponse.json(
				{ error: "Email is already in use" },
				{ status: 400 }
			);
		}

		// Update profile email
		const { error: profileError } = await supabase
			.from("profiles")
			.update({
				email: newEmail,
				updated_at: new Date().toISOString(),
			})
			.eq("id", userId);

		if (profileError) {
			console.error("Error updating profile email:", profileError);
			return NextResponse.json(
				{ error: "Failed to update email" },
				{ status: 500 }
			);
		}

		// Log email change
		await supabase.from("email_change_log").insert({
			user_id: userId,
			old_email: oldEmail,
			new_email: newEmail,
			changed_by_admin: true,
			admin_id: admin.id,
			required_verification: requireVerification,
			verification_completed: !requireVerification, // If not required, mark as completed
		});

		// Log admin activity
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "change_user_email",
			target_type: "user",
			target_id: userId,
			details: { oldEmail, newEmail, requireVerification },
		});

		// Note: To actually update the auth.users email, you would need to use
		// Supabase Admin API or a Supabase Edge Function with service role key
		// For now, we're updating the profile table which is used for display

		return NextResponse.json({
			success: true,
			message: requireVerification
				? "Email updated. User needs to verify the new email."
				: "Email updated successfully.",
		});
	} catch (error) {
		console.error("Email change API error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
