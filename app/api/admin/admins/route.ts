import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { logAdminActivity, requireAdmin, type AdminSession } from "@/lib/adminAuth";
import bcrypt from "bcryptjs";
import { parseJson } from "@/lib/api";
import { adminActionSchema, type AdminAction } from "@/lib/schemas/admin";

type CreateAction = Extract<AdminAction, { action: "create" }>;
type DeleteAction = Extract<AdminAction, { action: "delete" }>;
type SetRoleAction = Extract<AdminAction, { action: "set_role" }>;

function jsonError(error: string, status: number) {
	return NextResponse.json({ error }, { status });
}

// Loads another admin for a change. The owner can't target themselves or another owner.
async function loadTarget(owner: AdminSession, adminId: string) {
	if (adminId === owner.id) return { error: jsonError("You can't change your own account here", 400) };
	const { data: target } = await createServiceSupabase()
		.from("admin_users")
		.select("id, role")
		.eq("id", adminId)
		.maybeSingle();
	if (!target) return { error: jsonError("Admin not found", 404) };
	if (target.role === "super_admin") return { error: jsonError("The owner account can't be changed", 400) };
	return { target: target as { id: string; role: string } };
}

async function createAdmin(owner: AdminSession, body: CreateAction) {
	const supabase = createServiceSupabase();
	const { data: existing } = await supabase
		.from("admin_users")
		.select("id")
		.eq("email", body.email)
		.maybeSingle();
	if (existing) return jsonError("Email already registered as admin", 400);

	const role = body.role ?? "admin";
	const { data: newAdmin, error } = await supabase
		.from("admin_users")
		.insert({
			email: body.email,
			password_hash: await bcrypt.hash(body.password, 12),
			name: body.name,
			role,
			// The owner shares a temporary password; the new admin picks their own.
			must_change_password: true,
		})
		.select("id")
		.single();

	if (error || !newAdmin) {
		console.error("Create admin error:", error);
		return jsonError("Failed to create admin", 500);
	}

	await logAdminActivity(owner.id, "create_admin", { targetId: newAdmin.id, details: { role } });
	return NextResponse.json({ success: true });
}

async function deleteAdmin(owner: AdminSession, body: DeleteAction) {
	const loaded = await loadTarget(owner, body.adminId);
	if (loaded.error) return loaded.error;

	const { error } = await createServiceSupabase()
		.from("admin_users")
		.delete()
		.eq("id", body.adminId);
	if (error) {
		console.error("Delete admin error:", error);
		return jsonError("Failed to delete admin", 500);
	}

	await logAdminActivity(owner.id, "delete_admin", {
		targetId: body.adminId,
		details: { role: loaded.target.role },
	});
	return NextResponse.json({ success: true });
}

async function setAdminRole(owner: AdminSession, body: SetRoleAction) {
	const loaded = await loadTarget(owner, body.adminId);
	if (loaded.error) return loaded.error;
	if (loaded.target.role === body.role) return NextResponse.json({ success: true });

	const { error } = await createServiceSupabase()
		.from("admin_users")
		.update({ role: body.role, updated_at: new Date().toISOString() })
		.eq("id", body.adminId);
	if (error) {
		console.error("Change admin role error:", error);
		return jsonError("Failed to change role", 500);
	}

	// Sessions re-read the role on every request, so the change applies immediately.
	await logAdminActivity(owner.id, "change_admin_role", {
		targetId: body.adminId,
		details: { from: loaded.target.role, to: body.role },
	});
	return NextResponse.json({ success: true });
}

function runAction(owner: AdminSession, body: AdminAction) {
	switch (body.action) {
		case "create":
			return createAdmin(owner, body);
		case "delete":
			return deleteAdmin(owner, body);
		case "set_role":
			return setAdminRole(owner, body);
	}
}

// Owner-only: create, remove and re-role admins and moderators.
export async function POST(req: NextRequest) {
	try {
		const owner = await requireAdmin("super_admin");
		if (!owner) return jsonError("Unauthorized", 401);
		const parsed = await parseJson(req, adminActionSchema);
		if (!parsed.success) return parsed.response;
		return await runAction(owner, parsed.data);
	} catch (error) {
		console.error("Admin manage API error:", error);
		return jsonError("Something went wrong", 500);
	}
}
