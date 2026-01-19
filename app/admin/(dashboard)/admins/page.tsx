import { createServiceSupabase } from "@/lib/supabaseServer";
import { AdminsPanel, CreateAdminButton } from "../users/AdminsPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function getAdmins() {
	const supabase = createServiceSupabase();
	const { data: admins, error } = await supabase
		.from("admin_users")
		.select("id, email, name, role, is_active, created_at")
		.order("created_at", { ascending: false });

	if (error) {
		console.error("Error fetching admins:", error);
		return [];
	}

	return admins || [];
}

export default async function AdminsPage() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token")?.value;

	// Require admin session
	if (!adminToken) {
		redirect("/admin/signin");
	}

	// Verify super admin role
	const supabase = createServiceSupabase();
	const { data: self } = await supabase
		.from("admin_users")
		.select("role")
		.eq("id", adminToken)
		.eq("is_active", true)
		.single();

	if (!self || self.role !== "super_admin") {
		redirect("/admin/dashboard");
	}

	const admins = await getAdmins();

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Admins</h1>
					<p className="text-muted-foreground">
						Super admin can create or delete admins. Roles are indicated by badges.
					</p>
				</div>
				<CreateAdminButton />
			</div>

			<AdminsPanel admins={admins} />
		</div>
	);
}
