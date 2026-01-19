import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import crypto from "crypto";

async function verifyAdmin() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token");

	if (!adminToken) {
		return null;
	}

	const supabase = createServiceSupabase();
	const { data: admin } = await supabase
		.from("admin_users")
		.select("id, email, name, role")
		.eq("id", adminToken.value)
		.eq("is_active", true)
		.single();

	return admin;
}

function generateCode(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let code = "";
	const randomBytes = crypto.randomBytes(8);
	for (let i = 0; i < 8; i++) {
		code += chars[randomBytes[i] % chars.length];
	}
	return code;
}

export async function GET() {
	try {
		const admin = await verifyAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const supabase = createServiceSupabase();

		const { data: codes, error } = await supabase
			.from("admin_access_codes")
			.select("*")
			.order("created_at", { ascending: false });

		if (error) {
			console.error("Error fetching codes:", error);
			return NextResponse.json(
				{ error: "Failed to fetch codes" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ codes });
	} catch (error) {
		console.error("Access codes GET error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const admin = await verifyAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (admin.role !== "super_admin") {
			return NextResponse.json({ error: "Only super admin can create codes" }, { status: 403 });
		}

		const { expiresInDays } = await req.json();

		const supabase = createServiceSupabase();

		const code = generateCode();
		const expiresAt = expiresInDays
			? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
			: null;

		const { data: newCode, error } = await supabase
			.from("admin_access_codes")
			.insert({
				code,
				created_by: admin.id,
				expires_at: expiresAt,
			})
			.select()
			.single();

		if (error) {
			console.error("Error creating code:", error);
			return NextResponse.json(
				{ error: "Failed to create code" },
				{ status: 500 }
			);
		}

		// Log admin activity
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "create_access_code",
			target_type: "access_code",
			target_id: newCode.id,
			details: { code, expiresAt },
		});

		return NextResponse.json({ success: true, code: newCode });
	} catch (error) {
		console.error("Access codes POST error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const admin = await verifyAdmin();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (admin.role !== "super_admin") {
			return NextResponse.json({ error: "Only super admin can delete codes" }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const codeId = searchParams.get("id");

		if (!codeId) {
			return NextResponse.json(
				{ error: "Code ID is required" },
				{ status: 400 }
			);
		}

		const supabase = createServiceSupabase();

		// Check if code has been used
		const { data: code } = await supabase
			.from("admin_access_codes")
			.select("used_by")
			.eq("id", codeId)
			.single();

		if (code?.used_by) {
			return NextResponse.json(
				{ error: "Cannot delete a used access code" },
				{ status: 400 }
			);
		}

		const { error } = await supabase
			.from("admin_access_codes")
			.delete()
			.eq("id", codeId);

		if (error) {
			console.error("Error deleting code:", error);
			return NextResponse.json(
				{ error: "Failed to delete code" },
				{ status: 500 }
			);
		}

		// Log admin activity
		await supabase.from("admin_activity_log").insert({
			admin_id: admin.id,
			action: "delete_access_code",
			target_type: "access_code",
			target_id: codeId,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Access codes DELETE error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
