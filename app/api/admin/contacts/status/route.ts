import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/adminAuth";
import { parseJson } from "@/lib/api";
import { contactStatusSchema } from "@/lib/schemas/admin";

export async function POST(req: NextRequest) {
	try {
		const admin = await requireAdmin("moderator");
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(req, contactStatusSchema);
		if (!parsed.success) return parsed.response;
		const { contactId, status } = parsed.data;

		if (!contactId || !status) {
			return NextResponse.json(
				{ error: "Contact ID and status are required" },
				{ status: 400 }
			);
		}

		const validStatuses = ["new", "read", "replied", "archived"];
		if (!validStatuses.includes(status)) {
			return NextResponse.json(
				{ error: "Invalid status" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		const { error } = await supabase
			.from("contact_submissions")
			.update({
				status,
				updated_at: new Date().toISOString(),
			})
			.eq("id", contactId);

		if (error) {
			console.error("Error updating contact status:", error);
			return NextResponse.json(
				{ error: "Failed to update status" },
				{ status: 500 }
			);
		}

		// Log admin activity
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "update_contact_status",
			target_type: "contact",
			target_id: contactId,
			details: { status },
		});

		return NextResponse.json({ success: true, status });
	} catch (error) {
		console.error("Contact status API error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
