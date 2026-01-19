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

		const { userId, action, amount, unlimited, expiresAt } = await req.json();

		if (!userId || !action) {
			return NextResponse.json(
				{ error: "User ID and action are required" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		if (action === "add_credits") {
			const creditsToAdd = parseInt(amount) || 0;
			if (creditsToAdd <= 0) {
				return NextResponse.json(
					{ error: "Invalid credit amount" },
					{ status: 400 }
				);
			}

			// Get current credits and add
			const { data: profile } = await supabase
				.from("profiles")
				.select("ai_credits")
				.eq("id", userId)
				.single();

			const currentCredits = profile?.ai_credits ?? 2;

			const { error } = await supabase
				.from("profiles")
				.update({
					ai_credits: currentCredits + creditsToAdd,
					updated_at: new Date().toISOString(),
				})
				.eq("id", userId);

			if (error) {
				console.error("Error adding credits:", error);
				return NextResponse.json(
					{ error: "Failed to add credits" },
					{ status: 500 }
				);
			}

			// Log admin activity
			await supabase.from("admin_activity_log").insert({
				admin_id: admin.id,
				action: "add_credits",
				target_type: "user",
				target_id: userId,
				details: { amount: creditsToAdd },
			});

			return NextResponse.json({ success: true, creditsAdded: creditsToAdd });
		}

		if (action === "set_unlimited") {
			const { error } = await supabase
				.from("profiles")
				.update({
					unlimited_access: unlimited,
					unlimited_access_expires_at: unlimited ? (expiresAt || null) : null,
					updated_at: new Date().toISOString(),
				})
				.eq("id", userId);

			if (error) {
				console.error("Error updating unlimited access:", error);
				return NextResponse.json(
					{ error: "Failed to update unlimited access" },
					{ status: 500 }
				);
			}

			// Log admin activity
			await supabase.from("admin_activity_log").insert({
				admin_id: admin.id,
				action: unlimited ? "grant_unlimited_access" : "revoke_unlimited_access",
				target_type: "user",
				target_id: userId,
				details: { expiresAt },
			});

			return NextResponse.json({ success: true, unlimited, expiresAt });
		}

		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	} catch (error) {
		console.error("Credits API error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
