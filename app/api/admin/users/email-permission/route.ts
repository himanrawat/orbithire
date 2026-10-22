import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/adminAuth";
import { parseJson } from "@/lib/api";
import { emailPermissionSchema } from "@/lib/schemas/admin";

export async function POST(req: NextRequest) {
	try {
		const admin = await requireAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(req, emailPermissionSchema);
		if (!parsed.success) return parsed.response;
		const { userId, canChangeEmail } = parsed.data;

		if (!userId || typeof canChangeEmail !== "boolean") {
			return NextResponse.json(
				{ error: "User ID and canChangeEmail are required" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		const { error } = await supabase
			.from("profiles")
			.update({
				can_change_email: canChangeEmail,
				updated_at: new Date().toISOString(),
			})
			.eq("id", userId);

		if (error) {
			console.error("Error updating email permission:", error);
			return NextResponse.json(
				{ error: "Failed to update permission" },
				{ status: 500 }
			);
		}

		// Log admin activity
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: canChangeEmail ? "grant_email_change_permission" : "revoke_email_change_permission",
			target_type: "user",
			target_id: userId,
			details: { canChangeEmail },
		});

		return NextResponse.json({
			success: true,
			canChangeEmail,
		});
	} catch (error) {
		console.error("Email permission API error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
