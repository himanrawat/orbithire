import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/adminAuth";
import { parseJson } from "@/lib/api";
import { creditsActionSchema } from "@/lib/schemas/admin";

export async function POST(req: NextRequest) {
	try {
		const admin = await requireAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(req, creditsActionSchema);
		if (!parsed.success) return parsed.response;
		const { userId, action } = parsed.data;

		if (!userId || !action) {
			return NextResponse.json(
				{ error: "User ID and action are required" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		if (action === "add_credits") {
			const creditsToAdd = parsed.data.amount;
			if (creditsToAdd <= 0) {
				return NextResponse.json(
					{ error: "Invalid credit amount" },
					{ status: 400 }
				);
			}

			const { data: newBalance, error } = await supabase.rpc("add_ai_credits", {
				p_user_id: userId,
				p_amount: creditsToAdd,
			});

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

			return NextResponse.json({
				success: true,
				creditsAdded: creditsToAdd,
				balance: newBalance,
			});
		}

		if (action === "set_unlimited") {
			const { unlimited, expiresAt } = parsed.data;
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
