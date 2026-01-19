import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

async function getAdminSession() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token");

	if (!adminToken) return null;

	const supabase = createServiceSupabase();
	const { data: admin } = await supabase
		.from("admin_users")
		.select("id, role")
		.eq("id", adminToken.value)
		.eq("is_active", true)
		.single();

	return admin;
}

export async function POST(req: NextRequest) {
	try {
		const admin = await getAdminSession();
		if (!admin) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (admin.role !== "super_admin") {
			return NextResponse.json(
				{ error: "Only super admin can manage admins" },
				{ status: 403 }
			);
		}

		const body = await req.json();
		const action = body.action || "create";
		const supabase = createServiceSupabase();

		if (action === "create") {
			const { name, email, password } = body;
			if (!name || !email || !password) {
				return NextResponse.json(
					{ error: "name, email, and password are required" },
					{ status: 400 }
				);
			}
			if (password.length < 8) {
				return NextResponse.json(
					{ error: "Password must be at least 8 characters" },
					{ status: 400 }
				);
			}

			const { data: existing } = await supabase
				.from("admin_users")
				.select("id")
				.eq("email", email.toLowerCase())
				.single();
			if (existing) {
				return NextResponse.json(
					{ error: "Email already registered as admin" },
					{ status: 400 }
				);
			}

			const passwordHash = await bcrypt.hash(password, 12);
			const { data: newAdmin, error: createError } = await supabase
				.from("admin_users")
				.insert({
					email: email.toLowerCase(),
					password_hash: passwordHash,
					name,
					role: "admin",
				})
				.select("id")
				.single();

			if (createError || !newAdmin) {
				console.error("Create admin error:", createError);
				return NextResponse.json(
					{ error: "Failed to create admin" },
					{ status: 500 }
				);
			}

			await supabase.from("admin_activity_log").insert({
				admin_id: admin.id,
				action: "create_admin",
				target_type: "admin",
				target_id: newAdmin.id,
			});

			return NextResponse.json({ success: true });
		}

		if (action === "delete") {
			const { adminId } = body;
			if (!adminId) {
				return NextResponse.json(
					{ error: "adminId is required" },
					{ status: 400 }
				);
			}

			const { data: target, error: fetchError } = await supabase
				.from("admin_users")
				.select("role")
				.eq("id", adminId)
				.single();

			if (fetchError || !target) {
				return NextResponse.json({ error: "Admin not found" }, { status: 404 });
			}

			if (target.role === "super_admin") {
				return NextResponse.json(
					{ error: "Cannot delete the super admin" },
					{ status: 400 }
				);
			}

			const { error: deleteError } = await supabase
				.from("admin_users")
				.delete()
				.eq("id", adminId);

			if (deleteError) {
				console.error("Delete admin error:", deleteError);
				return NextResponse.json(
					{ error: "Failed to delete admin" },
					{ status: 500 }
				);
			}

			await supabase.from("admin_activity_log").insert({
				admin_id: admin.id,
				action: "delete_admin",
				target_type: "admin",
				target_id: adminId,
			});

			return NextResponse.json({ success: true });
		}

		return NextResponse.json({ error: "Unknown action" }, { status: 400 });
	} catch (error) {
		console.error("Admin manage API error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
